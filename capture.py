import picamera
import sys
import time

from PIL import Image

import Adafruit_ILI9341 as TFT
import Adafruit_GPIO as GPIO
import Adafruit_GPIO.SPI as SPI

# Raspberry Pi configuration.
DC = 18
RST = 23
SPI_PORT = 0
SPI_DEVICE = 0

# get the name
name = sys.argv[1]

# display
disp = TFT.ILI9341(DC, rst=RST, spi=SPI.SpiDev(SPI_PORT, SPI_DEVICE, max_speed_hz=64000000))
disp.begin()

# countdown
image = Image.open('/home/pi/cam/wait.jpg')
image = image.rotate(90).resize((240, 320))
disp.display(image)
time.sleep(1)
image = Image.open('/home/pi/cam/03.jpg')
image = image.rotate(90).resize((240, 320))
disp.display(image)
time.sleep(1)
image = Image.open('/home/pi/cam/02.jpg')
image = image.rotate(90).resize((240, 320))
disp.display(image)
time.sleep(1)
image = Image.open('/home/pi/cam/01.jpg')
image = image.rotate(90).resize((240, 320))
disp.display(image)
time.sleep(1)
image = Image.open('/home/pi/cam/cheese.jpg')
image = image.rotate(90).resize((240, 320))
disp.display(image)

# take the picture
camera = picamera.PiCamera()
camera.resolution = (1024, 768)
camera.shutter_speed = 6000000
camera.iso = 800
camera.vflip = False
time.sleep(1)
camera.exposure_mode = 'night'
#camera.exposure_mode = 'off'
camera.capture('/home/pi/cam/www/captions/' + name + '.jpg')

# DONE, now processing
image = Image.open('/home/pi/cam/done.jpg')
image = image.rotate(90).resize((240, 320))
disp.display(image)

# merge
background = Image.open('/home/pi/cam/www/captions/' + name + '.jpg')
foreground = Image.open('/home/pi/cam/www/imgs/watermark.png')
background.paste(foreground, (0, 0), foreground)
background.save('/home/pi/cam/www/captions/' + name + '.jpg', 'JPEG', subsampling=0, quality=100)

# exit
#sys.exit(name)
print name
