'use strict';

var
	CHANNEL_MIN_VALUE = 1000,
	CHANNEL_MID_VALUE = 1500,
	CHANNEL_MAX_VALUE = 2000,

	// What's the index of each channel in the MSP channel list?
	// drone >> receiver >> channel map
	// TREA1234
	// TAER1234
	channelMSPIndexes = {
		A: 3,
		E: 2,
		R: 1,
		T: 0,
		'1': 4,
		'2': 5,
		'3': 6,
		'4': 7,
	},
    
    // Set reasonable initial stick positions
	stickValues = {
		T: CHANNEL_MIN_VALUE,
		E: CHANNEL_MID_VALUE,
		A: CHANNEL_MID_VALUE,
		R: CHANNEL_MID_VALUE,
		'1': CHANNEL_MIN_VALUE,
		'2': CHANNEL_MIN_VALUE,
		'3': CHANNEL_MIN_VALUE,
		'4': CHANNEL_MIN_VALUE
	},
    
    // First the vertical axis, then the horizontal:
/*    gimbals = [
        ["throttle", "yaw"],
        ["pitch", "roll"],
    ],*/
	gimbals = [
		["T", "R"],
		["E", "A"],
	];


var gimbalElems = null;
var gimbalSize = null;


var mspHelper;
var STATUS = {
	connecting: false,
	connected: false,
	enableTX: false,
	mode: [],
	rate: 0.3
}
var SAVE = {
	url: 'tcp://192.168.4.1:2323',
//	url: 'tcp://192.168.1.60:2323',
	droneCh: 'TREA1234',
	ctrlCh: 'TREA',
	autoCenter: [0,1],
	aux: [
		[1100,1900],
		[1100,1900],
		[1100,1900],
		[1100,1900]
	],
	rates: [0.3, 0.6, 1.0]
}
var transmitTimer = null;

$(document).ready(function() {

	loadConfig()
	updateConfig()

	gimbalElems = [$('.control-gimbal.left'),$('.control-gimbal.right')]
	gimbalSize = $(gimbalElems[0]).height()

	for(var i=0; i<gimbalElems.length; i++){
		(function(ele, i){
			var tid = null;
			ele.on('touchstart mousedown', function(e) {
				e.preventDefault()
				if(e.changedTouches){
					tid = e.changedTouches[0].identifier
				}
//console.log(this, e, e.data, tid)
				ele.on('touchmove mousemove', [i, tid], handleGimbalDrag);
				e.data = [i, tid]
				handleGimbalDrag.call(this, e)
			});

			ele.on('touchend mouseup', function(e) {
				e.preventDefault()
				tid = null
				ele.off('touchmove mousemove', handleGimbalDrag);
//console.log(stickValues)
				// auto center
				if(SAVE.autoCenter[i]) stickValues[gimbals[i][0]] = CHANNEL_MID_VALUE;
				stickValues[gimbals[i][1]] = CHANNEL_MID_VALUE;
			});
		})($(gimbalElems[i]), i)
	}

	updateUI()

	$('#connectModal span.close').on('click', function(e){
		$('#connectModal').hide()
	})
	$('#rxicon').on('click', function(e){
		if(!STATUS.connected){
			$('#connectModal').show()
		}else{
			disconnect()
		}
	})
	$('#configModal span.close').on('click', function(e){
		$('#configModal').hide()
	})
	$('#configicon').on('click', function(e){
			$('#configModal').show()
	})
	$(document).on('click', function(e){
//		console.log(e.target, $(e.target).hasClass('modal'))
		var target = $(e.target)
		if(target.hasClass('modal')){
			target.hide()
		}
	})

	$('#connectBtn').on('click', function(e){
		if(!STATUS.connected){
			if(!STATUS.connecting){
				var url = $('#connectUrl').val() || 'tcp://192.168.4.1:2323'
				console.log('connectBtn', url)
				STATUS.connecting = true
				STATUS.connected = false
				serial.connect(url, {bitrate: 115200}, onOpen)

				SAVE.url = url
				window.localStorage.setItem('SAVE', JSON.stringify(SAVE))
				return
			}
		}
		disconnect()
	})

	$('#saveConfig').on('click', function(e){
		SAVE.droneCh = $('#droneCh').val() || 'TREA1234'
		SAVE.ctrlCh = $('#ctrlCh').val() || 'TREA'

		var autoCenter = [1,1]
		autoCenter[0] = ($('#lauto').is(":checked")) ? 1 : 0;
		autoCenter[1] = ($('#rauto').is(":checked")) ? 1 : 0;
		SAVE.autoCenter = autoCenter

		console.log('SAVE', SAVE)
		window.localStorage.setItem('SAVE', JSON.stringify(SAVE))

		updateConfig()
		$('#configModal').hide()
	})

	var rateClicks = 1;
	var rateBtn = $('#rateBtn')
	rateBtn.on('click touchend', function(e){
		if(('ontouchstart' in window) && (e.type == 'click')){
			return false
		}

		if(SAVE.rates[rateClicks]){
			STATUS.rate = SAVE.rates[rateClicks]
			rateClicks = (rateClicks+1) % SAVE.rates.length;
			rateBtn.text('rate: ' + Math.round(STATUS.rate * 100) + '%')
		}
	})

	for(var i=1; i<5; i++){
		(function(i){
			var color = ['success', 'info', 'warning']
			var auxClicks = 1;
			var auxBtn = $('#aux' + i)
			auxBtn.on('click touchend', function(e){
				if(('ontouchstart' in window) && (e.type == 'click')){
					return false
				}

				if(SAVE.aux[i-1][auxClicks]){
					stickValues[(i).toString()] = SAVE.aux[i-1][auxClicks]

					for(var j=0; j<color.length; j++) {
						auxBtn.removeClass(color[j])
					}
					auxBtn.addClass(color[auxClicks])

					auxClicks = (auxClicks+1) % SAVE.aux[i-1].length;
				}
			})
		})(i)
	}
})

function loadConfig() {
	var conf = JSON.parse(window.localStorage.getItem('SAVE'))
	if(conf){
		SAVE = conf
	}
	$('#droneCh').val(SAVE.droneCh)
	$('#ctrlCh').val(SAVE.ctrlCh)
	$('#connectUrl').val(SAVE.url)

	$('#lauto').attr('checked', !!(SAVE.autoCenter[0]))
	$('#rauto').attr('checked', !!(SAVE.autoCenter[1]))

	SAVE.aux = [
		[1100,1900],
		[1100,1900],
		[1100,1900],
		[1100,1900]
	]

	SAVE.rates = [0.3, 0.6, 1.0]
}

function updateConfig() {
	// set gimbals channel
	var ctrlCh = SAVE.ctrlCh
	if(ctrlCh.length == 4){
		gimbals = [
			[ctrlCh[0], ctrlCh[1]],
			[ctrlCh[2], ctrlCh[3]]
		]
	}

	// set encode channel
	var droneCh = SAVE.droneCh
	for(var i=0; i<droneCh.length; i++){
//		console.log(droneCh[i], i)
		channelMSPIndexes[droneCh[i]] = i
	}

	// set aux channel
	var aux = SAVE.aux
	for(var i=0; i<aux.length; i++){
		stickValues[(i+1).toString()] = aux[i][0]
	}
}

function updateUI() {
	updateControlPositions()

	var active = ((Date.now() - STATUS.last_received_timestamp) < 500);
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
//	console.log(this, e)
	e.preventDefault()
    var gimbal = $(this)
	var gimbalOffset = gimbal.offset()
	var gimbalSize = gimbal.height()
	var pageX = e.pageX
	var pageY = e.pageY
	var tid = e.data[1]
	if(e.changedTouches){
		var list = e.changedTouches
		for(var i=0; i<list.length; i++){
			var t = list[i]
			if(t.identifier == tid){
//console.log(tid, i, t)
				pageX = t.pageX
				pageY = t.pageY
				break
			}
		}
	}
//	console.log(e.data, (pageY - gimbalOffset.top), (pageX - gimbalOffset.left), gimbalSize)
	stickValues[gimbals[e.data[0]][0]] = stickPortionToChannelValue(1.0 - (pageY - gimbalOffset.top) / gimbalSize);
	stickValues[gimbals[e.data[0]][1]] = stickPortionToChannelValue((pageX - gimbalOffset.left) / gimbalSize);
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

	if (!STATUS.connected) {
		return;
	}

/*	if (!STATUS.enableTX) {
		return;
	}*/

	for (var stickName in stickValues) {
		var val = stickValues[stickName]

		// only roll & pitch
		if((stickName == 'E')||(stickName == 'A')){
			val = Math.round((val - CHANNEL_MID_VALUE) * STATUS.rate + CHANNEL_MID_VALUE)
		}
		channelValues[channelMSPIndexes[stickName]] = val;
	}

	mspHelper.setRawRx(channelValues)

	transmitTimer = setTimeout(transmitChannels, 25)
}

function update_packet_error(caller) {
    $('span.packet-error').html(caller.packet_error);
}

function onOpen(openInfo) {
	STATUS.connecting = false

	if(openInfo){
		STATUS.connected = true
        serial.onReceive.addListener(function(info) {
//console.log('MSP.read(info):', info);
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
		$('#connectErr').hide()
	}else{
		$('#connectErr').show()
		console.log('Failed to connect!!');
	}
}

function onConnect() {
	$('#connectModal').hide()
	$('#rxicon').addClass('active')

	updateLiveStats()

	if(transmitTimer) clearTimeout(transmitTimer)
	transmitChannels()
}

function onClosed(result) {
	if (result) { // All went as expected
		console.log('connectionClosedOk');
	} else { // Something went wrong
		console.log('connectionClosedFail');
	}

	$('#rxicon').removeClass('active')
	STATUS.connecting = false
	STATUS.connected = false

	MSP.clearListeners()
}

function disconnect() {
	STATUS.connected = false
	serial.disconnect(onClosed)
	MSP.disconnect_cleanup()
}

function updateLiveStats() {

	STATUS.last_received_timestamp = Date.now()

	var mode = []
	for (var i = 0; i < AUX_CONFIG.length; i++) {
		if (bit_check(CONFIG.mode, i)){
			var theMode = AUX_CONFIG[i]
			if((theMode != 'ARM') && (theMode != 'FAILSAFE')){
				mode.push(theMode)
			}
		}
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
	STATUS.mode = mode

	$('#flymode').text(STATUS.mode.join(','))

	$('#cycleTime').text('cycle: ' + CONFIG.cycleTime)
	var cpu = $('#cpuload')
	cpu.text('cpu: ' + CONFIG.cpuload + '%')
	if(CONFIG.cpuload > 80){
		cpu.removeClass('warning').addClass('danger')
	}else if(CONFIG.cpuload > 60){
		cpu.addClass('warning').removeClass('danger')
	}else{
		cpu.removeClass('warning').removeClass('danger')
	}

	setTimeout(function(){
		if(!STATUS.connected) return
		MSP.send_message(MSPCodes.MSP_BOXNAMES, false, false);
		// BTFL >= "2.9.1"
		MSP.send_message(MSPCodes.MSP_STATUS_EX, false, false, updateLiveStats);
		// else
//		MSP.send_message(MSPCodes.MSP_STATUS, false, false);
	}, 200)
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

