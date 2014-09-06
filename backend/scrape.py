from bs4 import BeautifulSoup
from mjpegtools import MjpegParser
import os
import Queue
import urllib
import time
import requests
import pymongo
import GeoIP
import threading
import socket

#########
# globals

# don't kill me google
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36"
headers = {'User-Agent': USER_AGENT}
# the number of pages of google search results you want returned each time. 10 per page
PAGE_AMOUNT = 15
DEBUG = True

# categories- mobotix, axismjpg, webcamxp, panamjpg (two searches)
search_mobotix = "inurl:/control/userimage.html"
search_axismjpg = "inurl:/view/index.shtml axis"
search_webcamxp = 'intitle:"my webcamXP server!"'
# the following two are handled exactly the same by both the checking and image downloading logic, they're just alternate ways of coming to the same family of software
search_panamjpg = 'inurl:"CgiStart?page=Single"'
search_panamjpg_1 = 'inurl:"ViewerFrame?Mode=Motion"'

test_mobotix = "http://www.videovalvonta.fi"
test_axismjpg = "http://axis-78tramore.axiscam.net/view/viewer_index.shtml"
test_panamjpg = "http://62.2.213.149/CgiStart?page=Single&Resolution=640x480&Quality=Clarity&RPeriod=0&Size=STD&PresetOperation=Move&Language=0"

###########
# functions

# print if debugging enabled
def dp(message):
    if DEBUG:
        print message

# scrape a page of google search results for the links it contains
def scrapegs(url):
    r = requests.get(url, headers=headers)
    rootsoup = BeautifulSoup(r.text)
    links = []
    for post in rootsoup.find_all('li', "g"):
        links.append(post.div.h3.a.get('href'))
    return links

# get n pages of a search result, dump their urls into an array
def getnpages(query,n):
    links = []
    basepage = "https://www.google.com/search?safe=off&q="
    san = urllib.quote(query)
    for i in range(0,n):
        url = basepage + san + "&start=" + str(i*10)
        links = links + scrapegs(url)
    return links

# checks for the dorktype, if not, it attempts a HTTP request and checks the error code
# return: True for site up, False for site down
def checksite(site,dorktype):
    if (dorktype == "mobotix"):
        url = site.replace("/control/userimage.html","/record/current.jpg")
        try:
            r = requests.get(url,headers=headers)
            return (r.status_code == 200)
        except requests.exceptions.ConnectionError:
            # fuck yo connection
            return False
    elif (dorktype == "webcamxp"):
        url = site + "/cam_1.jpg"
        try:
            r = requests.get(url,headers=headers)
            return (r.status_code == 200)
        except requests.exceptions.ConnectionError:
            return False
    else:
        try:
            r = requests.get(site,headers=headers)
            return (r.status_code == 200)
        except requests.exceptions.ConnectionError:
            return False

# utility method, saves a frame of the website to a path generated using 'id'. should return a boolean describing the success of the operation. we'll see how that turns out
def capturesite(site,dorktype,postid):
    # set up the path
    outfolder = "public"
    subfolder = str(postid)
    filename = str(int(time.time())) + ".jpg"
    outpath = os.path.join(outfolder,subfolder,filename)
    if (dorktype == "mobotix"):
        url = site.replace("/control/userimage.html","/record/current.jpg")
        urllib.urlretrieve(url, outpath)
        return True
    elif (dorktype == "axismjpg"):
        r = urllib.urlopen(site) #requests.get(site, headers=headers)
        for line in r.readlines():
            if "var imagepath" in line:
                varpath = line.split("\"")[1] # dirty hack to get the relative path to the mjpg
        url = "http://"+site.split("/")[2]+varpath
        mj = MjpegParser(url)
        try:
            im = mj.serve()
            with open(outpath,'wb') as filename:
                filename.write(im.as_image().read())
            return True
        except AttributeError:
            pass # mjpegparser can fuck up its __init__() on occasion. it still works.
            return False
    elif (dorktype == "webcamxp"):
        url = site + "/cam_1.jpg"
        urllib.urlretrieve(url, outpath)
        return True
    elif (dorktype == "panamjpg" or dorktype == "panamjpg1"):
        url = "http://"+site.split("/")[2]+"/nphMotionJpeg?Resolution=640x480&Quality=Clarity"
        mj = MjpegParser(url)
        try:
            im = mj.serve()
            # check if the resolution is less than 320 by 240- if it is, the cam is off
            if im.im.size[0] >= 320 and im.im.size[1] >= 240:
                with open(outpath,'wb') as filename:
                    filename.write(im.as_image().read())
                return True
        except AttributeError:
            pass
            return False
    else:
        # aww, we can't screenshot it. Oh well. Have a null-type
        return False

# check if link already exists in the DB. Returns True if the record exists, false otherwise
def linkexists(url,mongoc):
    record = mongoc.find_one({"url": url})
    return (record is not None)

def detectsoftware(url):
   # first- check for obvious shit in the URL. don't want to invoke any libraries if we don't have to
   if "/control/userimage.html" in url:
       return "mobotix"
   elif "/view/index.shtml" in url:
       return "axismjpg"
   elif "CgiStart?page=Single" in url:
       return "panamjpg"
   elif "ViewerFrame?Mode=Motion" in url:
       return "panamjpg1"
   else:
       # TODO: finish this method
       r = requests.get(url, headers=headers)
       soup = BeautifulSoup(r.text)
       if "webcamXP" in soup.title.text:
           return "webcamxp"

# params: url to be inserted, mongo collection pointer to be updated. Returns the _id of the inserted element
# set up the geoip param like this: g = GeoIP.new(GeoIP.GEOIP_MEMORY_CACHE)
def insert(url,user,dorktype,mongoc,geoip):
   current = int(time.time()) 
   # the colon takes care of errant port numbers
   hostname = url.split("/")[2].split(":")[0]
   addr = socket.gethostbyaddr(hostname)[2][0]
   tags = []
   location = geoip.country_name_by_name(addr) # sure, it's by name, but it takes addresses too! have an open mind
   if user is None:
       user = "staff"
   record = {"url": url,
           "text": str(addr),
           "up": 1,
           "down": 0,
           "tags": [],
           "location": str(location),
           "timestamp": current,
           "dateLast": current,
           "userid": user,
           "softwareType": dorktype}
   return mongoc.insert(record)

# builds a queue of pages to be checked and scraped
def scrapequeue(dorktype,queue):
    if dorktype == "mobotix":
        search = search_mobotix
    elif dorktype == "axismjpg":
        search = search_axismjpg
    elif dorktype == "webcamxp":
        search = search_webcamxp
    elif dorktype == "panamjpg":
        search = search_panamjpg
    elif dorktype == "panamjpg1":
        search = search_panamjpg1
    else:
        search = search_mobotix #default
    print search
    for item in getnpages(search,15):
        dp("Inserting "+item+" into the queue.")
        queue.put(item)

# thread-safe worker that will process each page in the queue
# params: queue to pull from, threadID for debugging, dorktype so we know what to process
#         mongoc and geoip to pass to insert (gotta avoid instantiating too many objects!)
def scrapeWorker(queue,threadID,dorktype,mongoc,geoip):
    queue_available = True
    while queue_available:
        try:
            url = queue.get(False)
            dp(threadID+" starting " + url)
            if not linkexists(url,mongoc):
                dp(threadID+" db ok    " + url)
                if checksite(url,dorktype):
                    dp(threadID+" site ok  " + url)
                    postid = insert(url,None,dorktype,mongoc,geoip)
                    dp(threadID+" inserted " + postid)
                    success = capturesite(url,dorktype,postid)
                    dp(threadID+" imaged?? " + success)
                    if not success:
                        queue_available = False # die on failure for now
        except Queue.Empty:
            dp(threadID+" finished.")
            queue_available = False

# we could have an insert() method that takes in a URL and type, parses and stores the information
# that could be called after checking that the URL is not in the db already
# then, a freshen() method that takes in the _id of the record to be freshened, checks for updates and takes a new screenshot, then deletes/updates the record accordingly

# general setup
gip = GeoIP.new(GeoIP.GEOIP_MEMORY_CACHE)
mc = pymongo.MongoClient('127.0.0.1',3001)
mdb = mc.meteor

# set up the queue for scraping (temporary, for testing purposes)
#q = Queue.Queue()
#scrapequeue("mobotix",q)
#for i in range(10):
#    t = threading.Thread(target=scrapeWorker, args = (q,str(i),"mobotix",mdb['cams'],gip))
#    t.start()

stuff = getnpages(search_panamjpg,3)
for item in stuff:
    print "foo"
    print checksite(item,"panamjpg")
    #capturesite(item,"panamjpg")
