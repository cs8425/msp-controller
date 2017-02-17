'use strict';

var
    CHANNEL_MIN_VALUE = 1000,
    CHANNEL_MID_VALUE = 1500,
    CHANNEL_MAX_VALUE = 2000,
    
    // What's the index of each channel in the MSP channel list?
    channelMSPIndexes = {
        roll: 0,
        pitch: 1,
        yaw: 2,
        throttle: 3,
        aux1: 4,
        aux2: 5,
        aux3: 6,
        aux4: 7,
    },
    
    // Set reasonable initial stick positions (Mode 2)
    stickValues = {
        throttle: CHANNEL_MIN_VALUE,
        pitch: CHANNEL_MID_VALUE,
        roll: CHANNEL_MID_VALUE,
        yaw: CHANNEL_MID_VALUE,
        aux1: CHANNEL_MIN_VALUE,
        aux2: CHANNEL_MIN_VALUE,
        aux3: CHANNEL_MIN_VALUE,
        aux4: CHANNEL_MIN_VALUE
    },
    
    // First the vertical axis, then the horizontal:
    gimbals = [
        ["throttle", "yaw"],
        ["pitch", "roll"],
    ],
    
    enableTX = false;

var gimbalElems = null;
var gimbalSize = null;

$(document).ready(function() {

	gimbalElems = [$('.control-gimbal.left'),$('.control-gimbal.right')]
	gimbalSize = $(gimbalElems[0]).height()

	for(var i=0; i<gimbalElems.length; i++){
		(function(ele, i){
			ele.on('touchstart mousedown', function(e) {
				e.preventDefault()
				ele.on('touchmove mousemove', i, handleGimbalDrag);
			});

			ele.on('touchend mouseup', function(e) {
				e.preventDefault()
				ele.off('touchmove mousemove', handleGimbalDrag);
			});
		})($(gimbalElems[i]), i)
	}

	updateUI()
})

function updateUI() {
	updateControlPositions()
	window.requestAnimationFrame(updateUI)
}

function handleGimbalDrag(e) {
//	console.log(this, e);
	e.preventDefault()
    var gimbal = $(this)
	var gimbalOffset = gimbal.offset()
	var gimbalSize = gimbal.height()
	var pageX = e.pageX || e.touches[0].pageX
	var pageY = e.pageY || e.touches[0].pageY
	console.log(e.data, (pageY - gimbalOffset.top), (pageX - gimbalOffset.left), gimbalSize)
	stickValues[gimbals[e.data][0]] = stickPortionToChannelValue(1.0 - (pageY - gimbalOffset.top) / gimbalSize);
	stickValues[gimbals[e.data][1]] = stickPortionToChannelValue((pageX - gimbalOffset.left) / gimbalSize);

//	updateControlPositions()
}

function stickPortionToChannelValue(portion) {
	portion = Math.min(Math.max(portion, 0.0), 1.0);

	return Math.round(portion * (CHANNEL_MAX_VALUE - CHANNEL_MIN_VALUE) + CHANNEL_MIN_VALUE);
}

function channelValueToStickPortion(channel) {
	return (channel - CHANNEL_MIN_VALUE) / (CHANNEL_MAX_VALUE - CHANNEL_MIN_VALUE);
}

function updateControlPositions() {
	for (var stickName in stickValues) {
		var stickValue = stickValues[stickName];

		// Look for the gimbal which corresponds to this stick name
		for (var gimbalIndex in gimbals) {
			var gimbal = gimbals[gimbalIndex]
			var gimbalElem = gimbalElems[gimbalIndex]
			var stickElem = $($(".control-stick")[gimbalIndex])

			if (gimbal[0] == stickName) {
				stickElem.css('top', (1.0 - channelValueToStickPortion(stickValue)) * gimbalSize + "px");
				break;
			} else if (gimbal[1] == stickName) {
				stickElem.css('left', channelValueToStickPortion(stickValue) * gimbalSize + "px");
				break;
			}
		}
	}
}

function update_packet_error(caller) {
    $('span.packet-error').html(caller.packet_error);
}

function microtime() {
    var now = new Date().getTime() / 1000;

    return now;
}

function millitime() {
    var now = new Date().getTime();

    return now;
}

var DEGREE_TO_RADIAN_RATIO = Math.PI / 180;

function degToRad(degrees) {
    return degrees * DEGREE_TO_RADIAN_RATIO;
}

function bytesToSize(bytes) {
    if (bytes < 1024) {
        bytes = bytes + ' Bytes';
    } else if (bytes < 1048576) {
        bytes = (bytes / 1024).toFixed(3) + ' KB';
    } else if (bytes < 1073741824) {
        bytes = (bytes / 1048576).toFixed(3) + ' MB';
    } else {
        bytes = (bytes / 1073741824).toFixed(3) + ' GB';
    }

    return bytes;
}


//serial.connect('tcp://192.168.4.1:2323', {bitrate: 115200}, onOpen);

function read_serial(info) {
	MSP.read(info);
}

function onOpen(openInfo) {
    if (openInfo) {
        // update connected_to
        GUI.connected_to = GUI.connecting_to;

        // reset connecting_to
        GUI.connecting_to = false;

        serial.onReceive.addListener(read_serial);

        FC.resetState();
        MSP.listen(update_packet_error);
        mspHelper = new MspHelper();
        MSP.listen(mspHelper.process_data.bind(mspHelper));
        
        // request configuration data
        MSP.send_message(MSPCodes.MSP_API_VERSION, false, false, function () {
//            GUI.log(chrome.i18n.getMessage('apiVersionReceived', [CONFIG.apiVersion]));

            if (semver.gte(CONFIG.apiVersion, CONFIGURATOR.apiVersionAccepted)) {

                MSP.send_message(MSPCodes.MSP_FC_VARIANT, false, false, function () {
                    if (CONFIG.flightControllerIdentifier === 'BTFL') {
                        MSP.send_message(MSPCodes.MSP_FC_VERSION, false, false, function () {

                            GUI.log(chrome.i18n.getMessage('fcInfoReceived', [CONFIG.flightControllerIdentifier, CONFIG.flightControllerVersion]));

                            MSP.send_message(MSPCodes.MSP_BUILD_INFO, false, false, function () {

                                GUI.log(chrome.i18n.getMessage('buildInfoReceived', [CONFIG.buildInfo]));

                                MSP.send_message(MSPCodes.MSP_BOARD_INFO, false, false, function () {

                                    GUI.log(chrome.i18n.getMessage('boardInfoReceived', [CONFIG.boardIdentifier, CONFIG.boardVersion]));

                                    MSP.send_message(MSPCodes.MSP_UID, false, false, function () {
                                        GUI.log(chrome.i18n.getMessage('uniqueDeviceIdReceived', [CONFIG.uid[0].toString(16) + CONFIG.uid[1].toString(16) + CONFIG.uid[2].toString(16)]));

                                        // continue as usually
//                                        CONFIGURATOR.connectionValid = true;

                                        onConnect();
                                    });
                                });
                            });
                        });
                    }
                });
            }
        });
    } else {
        console.log('Failed to open serial port');
        GUI.log(chrome.i18n.getMessage('serialPortOpenFail'));

        $('div#connectbutton a.connect_state').text(chrome.i18n.getMessage('connect'));
        $('div#connectbutton a.connect').removeClass('active');

        // unlock port select & baud
        $('div#port-picker #port, div#port-picker #baud, div#port-picker #delay').prop('disabled', false);

        // reset data
        $('div#connectbutton a.connect').data("clicks", false);
    }
}

function onConnect() {
    GUI.timeout_remove('connecting'); // kill connecting timer
    $('div#connectbutton a.connect_state').text(chrome.i18n.getMessage('disconnect')).addClass('active');
    $('div#connectbutton a.connect').addClass('active');
    $('#tabs ul.mode-disconnected').hide();
    $('#tabs ul.mode-connected-cli').show();
    
    if (CONFIG.flightControllerVersion !== '') {
        BF_CONFIG.features = new Features(CONFIG);

        $('#tabs ul.mode-connected').show();

        if (semver.gte(CONFIG.flightControllerVersion, "2.9.1")) {
            MSP.send_message(MSPCodes.MSP_STATUS_EX, false, false);
        } else {
            MSP.send_message(MSPCodes.MSP_STATUS, false, false);

            if (semver.gte(CONFIG.flightControllerVersion, "2.4.0")) {
                CONFIG.numProfiles = 2;
                $('.tab-pid_tuning select[name="profile"] .profile3').hide();
            } else {
                CONFIG.numProfiles = 3;
                $('.tab-pid_tuning select[name="rate_profile"]').hide();
            }
        }
    
        MSP.send_message(MSPCodes.MSP_DATAFLASH_SUMMARY, false, false);

        startLiveDataRefreshTimer();
    }
    
    var sensor_state = $('#sensor-status');
    sensor_state.show(); 
    
    var port_picker = $('#portsinput');
    port_picker.hide(); 

    var dataflash = $('#dataflash_wrapper_global');
    dataflash.show();
}

function onClosed(result) {
    if (result) { // All went as expected
        GUI.log(chrome.i18n.getMessage('serialPortClosedOk'));
    } else { // Something went wrong
        GUI.log(chrome.i18n.getMessage('serialPortClosedFail'));
    }

    $('#tabs ul.mode-connected').hide();
    $('#tabs ul.mode-connected-cli').hide();
    $('#tabs ul.mode-disconnected').show();

    var sensor_state = $('#sensor-status');
    sensor_state.hide();
    
    var port_picker = $('#portsinput');
    port_picker.show(); 
    
    var dataflash = $('#dataflash_wrapper_global');
    dataflash.hide();
    
    var battery = $('#quad-status_wrapper');
    battery.hide();
    
    MSP.clearListeners();
}

