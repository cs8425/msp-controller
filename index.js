'use strict';

var
    CHANNEL_MIN_VALUE = 1000,
    CHANNEL_MID_VALUE = 1500,
    CHANNEL_MAX_VALUE = 2000,

	// TREA1234
    // What's the index of each channel in the MSP channel list?
    channelMSPIndexes = {
        A: 3,
        E: 2,
        R: 1,
        T: 0,
        aux1: 4,
        aux2: 5,
        aux3: 6,
        aux4: 7,
    },
    
    // Set reasonable initial stick positions (Mode 2)
/*    stickValues = {
        throttle: CHANNEL_MIN_VALUE,
        pitch: CHANNEL_MID_VALUE,
        roll: CHANNEL_MID_VALUE,
        yaw: CHANNEL_MID_VALUE,
        aux1: CHANNEL_MIN_VALUE,
        aux2: CHANNEL_MIN_VALUE,
        aux3: CHANNEL_MIN_VALUE,
        aux4: CHANNEL_MIN_VALUE
    },*/
    stickValues = {
        T: CHANNEL_MIN_VALUE,
        E: CHANNEL_MID_VALUE,
        A: CHANNEL_MID_VALUE,
        R: CHANNEL_MID_VALUE,
        aux1: CHANNEL_MIN_VALUE,
        aux2: CHANNEL_MIN_VALUE,
        aux3: CHANNEL_MIN_VALUE,
        aux4: CHANNEL_MIN_VALUE
    },
    
    // First the vertical axis, then the horizontal:
/*    gimbals = [
        ["throttle", "yaw"],
        ["pitch", "roll"],
    ],*/
    gimbals = [
        ["T", "R"],
        ["E", "A"],
    ],
    
    enableTX = false;

var gimbalElems = null;
var gimbalSize = null;


var mspHelper;
var STATUS = {
	connecting: false,
	connected: false,
}

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

	$('#connectModal span.close').on('click', function(e){
		$('#connectModal').hide()
	})
	$('#rxicon').on('click', function(e){
		$('#connectModal').show()
	})
	$(document).on('click', function(e){
//		console.log(e.target, $(e.target).hasClass('modal'))
		var target = $(e.target)
		if(target.hasClass('modal')){
			target.hide()
		}
	})
	$('#connectUrl').val('tcp://192.168.4.1:2323')
	$('#connectBtn').on('click', function(e){
		if(!STATUS.connected){
			if(!STATUS.connecting){
				var url = $('#connectUrl').val()
				console.log('connectBtn', url)
				STATUS.connecting = true
				STATUS.connected = false
				serial.connect(url, {bitrate: 115200}, onOpen)
				return
			}
		}
		serial.disconnect(onClosed);
	})

})

function updateUI() {
	updateControlPositions()

	var active = ((Date.now() - STATUS.last_received_timestamp) < 300);
	if(active){
		$(".linkicon").css({
			'background-image': 'url(images/icons/cf_icon_link_active.svg)'
		});
	}else{
		$(".linkicon").css({
			'background-image': 'url(images/icons/cf_icon_link_grey.svg)'
		});
	}

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
//	console.log(e.data, (pageY - gimbalOffset.top), (pageX - gimbalOffset.left), gimbalSize)
	stickValues[gimbals[e.data][0]] = stickPortionToChannelValue(1.0 - (pageY - gimbalOffset.top) / gimbalSize);
	stickValues[gimbals[e.data][1]] = stickPortionToChannelValue((pageX - gimbalOffset.left) / gimbalSize);
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

function transmitChannels() {
	var channelValues = [0, 0, 0, 0, 0, 0, 0, 0];

	if (!enableTX) {
		return;
	}

	for (var stickName in stickValues) {
		channelValues[channelMSPIndexes[stickName]] = stickValues[stickName];
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


function onOpen(openInfo) {
	STATUS.connecting = false

	if(openInfo){
		STATUS.connected = true
        serial.onReceive.addListener(function(info) {
console.log('MSP.read(info):', info);
			MSP.read(info)
		});

        FC.resetState();
        MSP.listen(update_packet_error);
        mspHelper = new MspHelper();
        MSP.listen(mspHelper.process_data.bind(mspHelper));

        // request configuration data
		MSP.send_message(MSPCodes.MSP_API_VERSION, false, false, function () {
			console.log('MSP_API_VERSION:', CONFIG.apiVersion);

			MSP.send_message(MSPCodes.MSP_FC_VARIANT, false, false, function () {
/*				if (CONFIG.flightControllerIdentifier !== 'BTFL') {
					return
				}*/
				MSP.send_message(MSPCodes.MSP_FC_VERSION, false, false, function () {
					console.log('MSP_FC_VERSION:', CONFIG.flightControllerIdentifier, CONFIG.flightControllerVersion);

					MSP.send_message(MSPCodes.MSP_BUILD_INFO, false, false, function () {
						console.log('MSP_BUILD_INFO:', CONFIG.buildInfo);

						MSP.send_message(MSPCodes.MSP_BOARD_INFO, false, false, function () {
							console.log('MSP_BOARD_INFO:', CONFIG.boardIdentifier, CONFIG.boardVersion);

							MSP.send_message(MSPCodes.MSP_UID, false, false, function () {
								console.log('uniqueDeviceIdReceived:', CONFIG.uid[0].toString(16) + CONFIG.uid[1].toString(16) + CONFIG.uid[2].toString(16));

								// continue as usually
								// CONFIGURATOR.connectionValid = true;
								onConnect();
							});
						});
					});
				});
			});

		});

	}else{
		console.log('Failed to connect!!');
	}
}

function onConnect() {
	$('#rxicon').addClass('active')

	updateLiveStats()
}

function onClosed(result) {
	if (result) { // All went as expected
		GUI.log(chrome.i18n.getMessage('serialPortClosedOk'));
	} else { // Something went wrong
		GUI.log(chrome.i18n.getMessage('serialPortClosedFail'));
	}

	$('#rxicon').removeClass('active')
	STATUS.connecting = false

	MSP.clearListeners();
}

function updateLiveStats() {

	STATUS.last_received_timestamp = Date.now()

	for (var i = 0; i < AUX_CONFIG.length; i++) {
		if (AUX_CONFIG[i] == 'ARM') {
			if (bit_check(CONFIG.mode, i))
				$(".armedicon").css({
					'background-image': 'url(images/icons/cf_icon_armed_active.svg)'
				});
			else
				$(".armedicon").css({
					'background-image': 'url(images/icons/cf_icon_armed_grey.svg)'
				});
		}
		if (AUX_CONFIG[i] == 'FAILSAFE') {
			if (bit_check(CONFIG.mode, i))
				$(".failsafeicon").css({
					'background-image': 'url(images/icons/cf_icon_failsafe_active.svg)'
				});
			else
				$(".failsafeicon").css({
					'background-image': 'url(images/icons/cf_icon_failsafe_grey.svg)'
				});
		}
	}

	MSP.send_message(MSPCodes.MSP_BOXNAMES, false, false);
	// BTFL >= "2.9.1"
	MSP.send_message(MSPCodes.MSP_STATUS_EX, false, false, updateLiveStats);
	// else
//	MSP.send_message(MSPCodes.MSP_STATUS, false, false);

}

// tools
function bit_check(num, bit) {
	return ((num >> bit) % 2 != 0);
}

function bit_set(num, bit) {
	return num | 1 << bit;
}

function bit_clear(num, bit) {
	return num & ~(1 << bit);
}

