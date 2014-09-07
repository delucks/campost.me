from bs4 import BeautifulSoup
from mjpegtools import MjpegParser
from PIL import Image
import os
import errno
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
if DEBUG:
    numthreads = 1
else:
    numthreads = 10

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
    #r = requests.get(url, headers=headers)
    fh = open(url,'r')
    rootsoup = BeautifulSoup(fh.read())
    links = []
    for post in rootsoup.find_all('li', "g"):
        links.append(post.div.h3.a.get('href'))
    return links

# get n pages of a search result, dump their urls into an array
# query used to be the actual google query but fuck google so it's now the dork! :D
def getnpages(query,n):
    # add in pages manually here
    if query == "direct":
        links = [ "http://wwc.instacam.com/instacamimg/FRSTB/FRSTB_l.jpg","http://wwc.instacam.com/instacamimg/ANNPS/ANNPS_l.jpg","http://wwc.instacam.com/instacamimg/ANNEA/ANNEA_l.jpg","http://wwc.instacam.com/instacamimg/BLMRE/BLMRE_l.jpg","http://wwc.instacam.com/instacamimg/BLTND/BLTND_l.jpg","http://wwc.instacam.com/instacamimg/BLTPR/BLTPR_l.jpg","http://wwc.instacam.com/instacamimg/BLTDC/BLTDC_l.jpg","http://wwc.instacam.com/instacamimg/OWNHS/OWNHS_l.jpg","http://wwc.instacam.com/instacamimg/PLTMR/PLTMR_l.jpg","http://wwc.instacam.com/instacamimg/RSTRT/RSTRT_l.jpg","http://wwc.instacam.com/instacamimg/BLLRT/BLLRT_l.jpg","http://wwc.instacam.com/instacamimg/TWSNC/TWSNC_l.jpg","http://wwc.instacam.com/instacamimg/CHSRL/CHSRL_l.jpg","http://wwc.instacam.com/instacamimg/MNCMG/MNCMG_l.jpg","http://wwc.instacam.com/instacamimg/MTAIR/MTAIR_l.jpg","http://wwc.instacam.com/instacamimg/MRNNG/MRNNG_l.jpg","http://wwc.instacam.com/instacamimg/SFDRK/SFDRK_l.jpg","http://wwc.instacam.com/instacamimg/IJAMS/IJAMS_l.jpg","http://wwc.instacam.com/instacamimg/MIDTN/MIDTN_l.jpg","http://wwc.instacam.com/instacamimg/FRMDD/FRMDD_l.jpg","http://wwc.instacam.com/instacamimg/SWNTN/SWNTN_l.jpg","http://wwc.instacam.com/instacamimg/BLRAI/BLRAI_l.jpg","http://wwc.instacam.com/instacamimg/HVRDG/HVRDG_l.jpg","http://wwc.instacam.com/instacamimg/ELLPH/ELLPH_l.jpg","http://wwc.instacam.com/instacamimg/GLNLG/GLNLG_l.jpg","http://wwc.instacam.com/instacamimg/PTMCR/PTMCR_l.jpg","http://wwc.instacam.com/instacamimg/MZTGM/MZTGM_l.jpg","http://wwc.instacam.com/instacamimg/AWSHQ/AWSHQ_l.jpg","http://wwc.instacam.com/instacamimg/GRMCG/GRMCG_l.jpg","http://wwc.instacam.com/instacamimg/PTOMC/PTOMC_l.jpg","http://wwc.instacam.com/instacamimg/RCRCH/RCRCH_l.jpg","http://wwc.instacam.com/instacamimg/RCKMC/RCKMC_l.jpg","http://wwc.instacam.com/instacamimg/SNDYS/SNDYS_l.jpg","http://wwc.instacam.com/instacamimg/SDYSP/SDYSP_l.jpg","http://wwc.instacam.com/instacamimg/LRSTV/LRSTV_l.jpg","http://wwc.instacam.com/instacamimg/NJMOY/NJMOY_l.jpg","http://wwc.instacam.com/instacamimg/HGNTC/HGNTC_l.jpg","http://wwc.instacam.com/instacamimg/OCNPP/OCNPP_l.jpg","http://wwc.instacam.com/instacamimg/MRNNG/MRNNG_l.jpg","http://wwc.instacam.com/instacamimg/WSHWJ/WSHWJ_l.jpg","http://wwc.instacam.com/instacamimg/WSHCN/WSHCN_l.jpg","http://wwc.instacam.com/instacamimg/WSHNP/WSHNP_l.jpg","http://wwc.instacam.com/instacamimg/ALXCM/ALXCM_l.jpg","http://wwc.instacam.com/instacamimg/ALXXD/ALXXD_l.jpg","http://wwc.instacam.com/instacamimg/BURKK/BURKK_l.jpg","http://wwc.instacam.com/instacamimg/CHJML/CHJML_l.jpg","http://wwc.instacam.com/instacamimg/FRFXN/FRFXN_l.jpg","http://wwc.instacam.com/instacamimg/FRFXA/FRFXA_l.jpg","http://wwc.instacam.com/instacamimg/GRTFL/GRTFL_l.jpg","http://wwc.instacam.com/instacamimg/MNSMF/MNSMF_l.jpg","http://wwc.instacam.com/instacamimg/RSTFM/RSTFM_l.jpg","http://wwc.instacam.com/instacamimg/RCCMN/RCCMN_l.jpg","http://wwc.instacam.com/instacamimg/VCHMN/VCHMN_l.jpg","http://wwc.instacam.com/instacamimg/VBBAY/VBBAY_l.jpg","http://wwc.instacam.com/instacamimg/GTTYS/GTTYS_l.jpg","http://wwc.instacam.com/instacamimg/WSTCH/WSTCH_l.jpg","http://wwc.instacam.com/instacamimg/CHWTR/CHWTR_l.jpg","http://wwc.instacam.com/instacamimg/HRSHY/HRSHY_l.jpg","http://wwc.instacam.com/instacamimg/OXFPG/OXFPG_l.jpg","http://wwc.instacam.com/instacamimg/PHLDM/PHLDM_l.jpg","http://wwc.instacam.com/instacamimg/MGNWL/MGNWL_l.jpg","http://wwc.instacam.com/instacamimg/RBBPH/RBBPH_l.jpg" ]
        return links
    elif query == "axismjpg":
        links = [ "http://webcam.uoregon.edu/en/index.html","http://wc2.dartmouth.edu/view/index.shtml" ]
    else:
        links = [ "http://webcam.uoregon.edu/en/index.html" ]
    #basepage = "https://www.google.com/search?safe=off&q="
    #san = urllib.quote(query)
    # also used to be range 0,n but fuck google
    for i in range(0,n):
        #url = basepage + san + "&start=" + str(i*10)
        url = "backend/.responses/response-"+query+"-"+str(n)+".html"
        links = links + scrapegs(url)
    return links

# checks for the dorktype, if not, it attempts a HTTP request and checks the error code
# return: True for site up, False for site down
def checksite(site,dorktype):
    if (site == "http://webcam.uoregon.edu/en/index.html"):
        dp("checksite uoregon")
        url = "http://webcam.uoregon.edu/oneshotimage1"
        try:
            dp("checksite request")
            r = requests.get(url,headers=headers)
            dp(r.status_code)
            return (r.status_code == 200)
        except requests.exceptions.ConnectionError:
            dp("checksite connection error")
            return False
    if (dorktype == "direct"):
        url = site
        dp("checksite direct")
        try:
            dp("checksite request")
            r = requests.get(url,headers=headers)
            dp(r.status_code)
            return (r.status_code == 200)
        except requests.exceptions.ConnectionError:
            dp("checksite connection error")
            return False
    elif (dorktype == "mobotix"):
        dp("checksite mobotix")
        url = site.replace("/control/userimage.html","/record/current.jpg")
        try:
            dp("checksite request")
            r = requests.get(url,headers=headers)
            dp(r.status_code)
            return (r.status_code == 200)
        except requests.exceptions.ConnectionError:
            # fuck yo connection
            dp("checksite connection error")
            return False
    elif (dorktype == "webcamxp"):
        dp("checksite webcamxp")
        url = site + "/cam_1.jpg"
        try:
            dp("checksite request")
            r = requests.get(url,headers=headers)
            dp(r.status_code)
            return (r.status_code == 200)
        except requests.exceptions.ConnectionError:
            dp("checksite connection error")
            return False
    elif (dorktype == "axismjpg"):
        dp("checksite axismjpg")
        url = site.replace("/index.shtml","/snapshot.shtml?picturepath=/jpg/image.jpg&width=640")
        try:
            dp("checksite request")
            r = requests.get(url,headers=headers)
            dp(r.status_code)
            return (r.status_code == 200)
        except requests.exceptions.ConnectionError:
            dp("checksite connection error")
            return False
    else:
        dp("checksite generic")
        try:
            dp("checksite request")
            r = requests.get(site,headers=headers)
            dp(r.status_code)
            return (r.status_code == 200)
        except requests.exceptions.ConnectionError:
            dp("checksite connection error")
            return False

# utility method, saves a frame of the website to a path generated using 'id'. should return a boolean describing the success of the operation. we'll see how that turns out
def capturesite(site,dorktype,postid):
    # set up the path
    outfolder = "public"
    subfolder = str(postid)
    filename = str(int(time.time())) + ".jpg"
    # first make the dir for the post if it doesn't exist
    idpath = os.path.join(outfolder,subfolder)
    try:
        os.makedirs(idpath)
    except OSError as exception:
        if exception.errno != errno.EEXIST:
            raise
    outpath = os.path.join(outfolder,subfolder,filename)
    if (site == "http://webcam.uoregon.edu/en/index.html"):
        url = "http://webcam.uoregon.edu/oneshotimage1"
        urllib.urlretrieve(url, outpath)
        return True
    if (dorktype == "mobotix"):
        url = site.replace("/control/userimage.html","/record/current.jpg")
        urllib.urlretrieve(url, outpath)
        return True
    elif (dorktype == "axismjpg"):
        url = site.replace("/index.shtml","/snapshot.shtml?picturepath=/jpg/image.jpg&width=640")
        urllib.urlretrieve(url, outpath)
        try:
            im = Image.open(outpath)
            return True
        except IOError:
            # not a valid image file
            os.unlink(outpath)
            return False 
    elif (dorktype == "direct"):
        urllib.urlretrieve(site,outpath)
        return True
    elif (dorktype == "webcamxp"):
        url = site + "/cam_1.jpg"
        urllib.urlretrieve(url, outpath)
        return True
    elif (dorktype == "panamjpg" or dorktype == "panamjpg_1"):
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
    dp("linkexists returns: "+str(record))
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
       return "panamjpg_1"
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
   #try:
   addr = socket.gethostbyaddr(hostname)[2][0]
   #except Exception:
   #    print hostname
   #    raise SystemExit
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

def uniq(array):
    d = {}
    for a in array:
        d[a] = 1
    return d.keys()

# builds a queue of pages to be checked and scraped
def scrapequeue(dorktype,queue):
    dp("Searching: "+dorktype)
    for item in uniq(getnpages(dorktype,14)):
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
                    dp(threadID+" inserted " + str(postid))
                    success = capturesite(url,dorktype,postid)
                    if not success:
                        #mongoc.remove(postid)
                        dp(threadID+" imaging failed.")
                    else:
                        dp(threadID+" imaging succeeded.")
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
q = Queue.Queue()
dork = "direct"
scrapequeue(dork,q)
for i in range(numthreads):
    t = threading.Thread(target=scrapeWorker, args = (q,str(i),dork,mdb['cams'],gip))
    t.start()

#stuff = getnpages(search_panamjpg,3)
#for item in stuff:
#    print "foo"
#    print checksite(item,"panamjpg")
#    #capturesite(item,"panamjpg")
