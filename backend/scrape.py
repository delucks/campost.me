from bs4 import BeautifulSoup
from mjpegtools import MjpegParser
import os
import urllib
import time
import requests
import Queue
import threading
import cv2
import numpy

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

# checks for the category, if not, it attempts a HTTP request and checks the error code
# return: True for site up, False for site down
def checksite(site,category):
    if (category == "mobotix"):
        url = site.replace("/control/userimage.html","/record/current.jpg")
        try:
            r = requests.get(url,headers=headers)
            return (r.status_code == 200)
        except requests.exceptions.ConnectionError:
            # fuck yo connection
            return False
    elif (category == "axismjpg"):
        # there's no way to open the mjpg without reading data
        try:
            r = requests.get(site,headers=headers)
            return (r.status_code == 200)
        except requests.exceptions.ConnectionError:
            return False
    elif (category == "webcamxp"):
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

# not sure what this should return yet. takes an image from the current webcam feed
def capturesite(site,category):
    if (category == "mobotix"):
        url = site.replace("/control/userimage.html","/record/current.jpg")
        outfolder = "."
        filename = int(time.time())
        outpath = os.path.join(outfolder,filename)
        urllib.urlretrieve(url, outpath)
    elif (category == "axismjpg"):
        r = urllib.urlopen(site) #requests.get(site, headers=headers)
        for line in r.readlines():
            if "var imagepath" in line:
                varpath = line.split("\"")[1] # dirty hack to get the relative path to the mjpg
        url = "http://"+site.split("/")[2]+varpath
        mj = MjpegParser(url)
        try:
            im = mj.serve()
            with open(str(time.time())+".jpg",'wb') as filename:
                filename.write(im.as_image().read())
        except AttributeError:
            pass # mjpegparser can fuck up its __init__() on occasion. it still works.
    elif (category == "webcamxp"):
        url = site + "/cam_1.jpg"
        outfolder = "."
        filename = int(time.time())
        outpath = os.path.join(outfolder,filename)
        urllib.urlretrieve(url, outpath)
    elif (category == "panamjpg"):
        url = "http://"+site.split("/")[2]+"/nphMotionJpeg?Resolution=640x480&Quality=Clarity"
        mj = MjpegParser(url)
        try:
            im = mj.serve()
            # check if the resolution is less than 320 by 240- if it is, the cam is off
            if im.im.size[0] >= 320 and im.im.size[1] >= 240:
                with open(str(time.time())+".jpg",'wb') as filename:
                    filename.write(im.as_image().read())
        except AttributeError:
            pass

# categories- mobotix, axismjpg, webcamxp, panamjpg
search_mobotix = "inurl:/control/userimage.html"
search_axismjpg = "inurl:/view/index.shtml axis"
search_webcamxp = 'intitle:"my webcamXP server!"'
search_panamjpg = 'inurl:"CgiStart?page=Single"'

test_mobotix = "http://www.videovalvonta.fi"
test_axismjpg = "http://axis-78tramore.axiscam.net/view/viewer_index.shtml"
test_panamjpg = "http://62.2.213.149/CgiStart?page=Single&Resolution=640x480&Quality=Clarity&RPeriod=0&Size=STD&PresetOperation=Move&Language=0"

stuff = getnpages(search_panamjpg,2)
for item in stuff:
    #print checksite(item,"axismjpg")
    capturesite(item,"panamjpg")
