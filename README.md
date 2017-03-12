# MSP-Controller of Cordova-based app

# Warning !!
## Currently command go through TCP, might freeze if WiFi signal too weak.
## Use it carefully!!

### Some Screenshots

![startup](https://raw.githubusercontent.com/cs8425/msp-controller/master/docs/screenshot001.png)

![connected](https://raw.githubusercontent.com/cs8425/msp-controller/master/docs/screenshot002.png)

![armed](https://raw.githubusercontent.com/cs8425/msp-controller/master/docs/screenshot003.png)

![connection popup](https://raw.githubusercontent.com/cs8425/msp-controller/master/docs/screenshot004.png)

![calibration popup](https://raw.githubusercontent.com/cs8425/msp-controller/master/docs/screenshot005.png)

##### config popup

![config](https://raw.githubusercontent.com/cs8425/msp-controller/master/docs/screenshot006.png)

![config](https://raw.githubusercontent.com/cs8425/msp-controller/master/docs/screenshot007.png)

### TODO
 - [x] <del>trim buttons/slides</del> done!
 - [ ] More detailed setting page
 - [x] <del>Auto get drone's RX map (by `MSP_RX_MAP`)</del> done!


### Build you self
1. create a cordova project: `cordova create hello com.example.hello HelloWorld`
2. cd in to project directory
3. add platforms: `cordova platform add android --save`
4. add plugin for tcp link: `cordova plugin add https://github.com/cs8425/cordova-plugin-chrome-apps-sockets-tcp.git#fix-tcp-read-stuck`
5. add plugin for accelerometer: `cordova plugin add cordova-plugin-device-motion`
6. remove sample `www`: `rm -rf www`
7. clone this app: `git clone https://github.com/cs8425/msp-controller.git www`
8. build project: `cordova build android`


