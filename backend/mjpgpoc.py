url = 'http://axis-78tramore.axiscam.net/mjpg/1/video.mjpg'
new = 'http://213.196.182.244/mjpg/video.mjpg'
other = 'http://198.82.159.136/mjpg/video.mjp'
from mjpegtools import MjpegParser
mj = MjpegParser(new)
im = mj.serve()
with open('frame.jpg','wb') as filename:
    filename.write(im.as_image().read())
