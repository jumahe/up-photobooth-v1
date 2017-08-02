import picamera
#from RPi import GPIO
#import time

# init GPIO
#GPIO.setwarnings(False)
#GPIO.setmode(GPIO.BCM)

# create camera capture
camera = picamera.PiCamera()
camera.resolution = (1024, 768)
camera.vflip = True
camera.exposure_mode = 'night'
camera.capture('/home/pi/cam/www/imgs/photo.jpg')

# exit
exit()
