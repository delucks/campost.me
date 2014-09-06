from bs4 import BeautifulSoup
import os
import urllib
import time
import requests
import Queue
import threading

# don't kill me google
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36"
headers = {'User-Agent': USER_AGENT}

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

def checksite(site,category):
    # checks for the category, if not, it attempts a HTTP request and checks the error code
    if (category == "mobotix"):
        url = site.replace("/control/userimage.html","/record/current.jpg")
        #print url
        #r = requests.get(url,headers=headers)
        #return (r.status_code == 200)
        try:
            r = requests.get(url,headers=headers)
            return (r.status_code == 200)
        except requests.exceptions.ConnectionError:
            # fuck yo errors
            return False
    else:
        try:
            r = requests.get(site,headers=headers)
            return (r.status_code == 200)
        except requests.exceptions.ConnectionError:
            return False

def capturesite(site,category):
    if (category == "mobotix"):
        url = site.replace("/control/userimage.html","/record/current.jpg")
    outfolder = "."
    filename = int(time.time())
    outpath = os.path.join(outfolder,filename)
    urllib.urlretrieve(url, outpath)

search_mobotix = "inurl:/control/userimage.html"

test_mobotix = "http://www.videovalvonta.fi"

stuff = getnpages(search_mobotix,3)
for item in stuff:
    print checksite(item,"mobotix")
