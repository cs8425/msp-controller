# MSP-Controller of Cordova-based app

# Warning !!
## Currently command go through TCP, might freeze if WiFi signal too weak.
## Use it carefully!!

### TODO
	- [ ] trim buttons/slides
	- [ ] More detailed setting page
	- [ ] Auto get drone's RX map (by `MSP_RX_MAP`)


### Build you self
1. create a cordova project: `cordova create hello com.example.hello HelloWorld`
2. cd in to project directory
3. add platforms: `cordova platform add android --save`
4. add plugin: `cordova plugin add https://github.com/cs8425/cordova-plugin-chrome-apps-sockets-tcp.git#fix-tcp-read-stuck`
5. remove sample `www`: `rm -rf www`
6. clone this app: `git clone https://github.com/cs8425/msp-controller.git www`
7. build project: `cordova build android`


