'use strict';
var cordovaAPI = 0;
if (document.URL.indexOf('file:///android_asset/www/') !== -1) {
	console.log('We are in cordova-based app!!');

	if(cordovaAPI) {
		console.log('cordovaAPI inited!!', cordovaAPI);
	}
	cordovaAPI++;

	var patchAPI = function () {
		window.chrome = window.chrome || {};
		var chrome = window.chrome;

		chrome.runtime

		var nop = function () {};
		var empty = function (cb) {
			if (cb) cb([]);
		};

		// lots of fake API

		// chrome.runtime.*
		chrome.runtime = chrome.runtime || {};
		chrome.runtime._Manifest = {
			version: 'fake'
		};
		chrome.runtime.getManifest = chrome.runtime.getManifest || function() {
			return chrome.runtime._Manifest;
		};
		$.getJSON('manifest.json', function(json) {
			console.log('loaded manifest.json', json);
			chrome.runtime._Manifest = json;
		});

		// load '_locales/en/messages.json'
		chrome.i18n = chrome.i18n || {};
		chrome.i18n.getMessage = chrome.i18n.getMessage || function(messageID, args) {
			var msg = chrome.i18n._locales[messageID].message;
			var out = msg.replace(/\$(\d+)/g, function(o,i) {
				return args[parseInt(i)-1];
			});
			return out;
		};
		chrome.i18n._locales = chrome.i18n._locales || {};
		$.getJSON('messages.json', function(json) {
			console.log('loaded messages.json', json);
			chrome.i18n._locales = json;
		});

		// chrome.serial.*
		chrome.serial = chrome.serial || {};
		chrome.serial.connect = chrome.serial.connect || function (path, options, cb) {
			if (cb) cb();
		};
		chrome.serial.getDevices = chrome.serial.getDevices || function (cb) {
			if (cb) cb([]);
		};

		// chrome.usb.*
		chrome.usb = chrome.usb || {};
		chrome.usb.getDevices = chrome.usb.getDevices || function (dev, cb) {
			if (cb) cb([]);
		};

		// chrome.storage.*
		chrome.storage = chrome.storage || {};
		chrome.storage.local = chrome.storage.local || {};
		chrome.storage.local.set = chrome.storage.local.set || function (obj, cb) {
			var storage = window.localStorage;

			console.log('chrome.storage.local.set', obj);

			if (typeof obj === "object") {
				for(var idx in obj) {
					storage.setItem(idx, JSON.stringify(obj[idx]));
				}
			}

			if (cb) cb();
		};;
		chrome.storage.local.get = chrome.storage.local.get || function (key, cb) {
			var storage = window.localStorage;

			if (Array.isArray(key)) {
				var out = {};
				for (var i=0; i<key.length; i++) {
					var k = key[i];
					var val = storage.getItem(k);
					out[k] = JSON.parse(val);
				}

				console.log('chrome.storage.local.get', key, out);
				cb(out);
			} else {
				var val = JSON.parse(storage.getItem(key));
				var out = {};
				out[key] = val;

				console.log('chrome.storage.local.get', key, val, out);
				cb(out);
			}
		};

		// chrome.notifications.*
		chrome.notifications = chrome.notifications || {};
		chrome.notifications.create = chrome.notifications.create || nop;

		var onDeviceReady = function (){
			mspLiveDataRefreshTime = 500;
			MSP.timeout = 1500;
			startMainPage(null, true);
			serialBackendInit(null, true);
		}
		var onDevicePause = function (){
			// do auto disconnect
			if (GUI.connected_to || GUI.connecting_to) {
				$('a.connect').click();
			} else {
				serial.disconnect();
			}
		}

		document.addEventListener("deviceready", onDeviceReady, false);
		document.addEventListener("pause", onDevicePause, false);
	}

	$.getScript('cordova.js', function( data, textStatus, jqxhr ) {
		console.log( textStatus ); // Success
		console.log( jqxhr.status ); // 200
		console.log('cordova was loaded.');

		patchAPI();
	});
}

