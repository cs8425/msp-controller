'use strict';

var
	CHANNEL_MIN_VALUE = 1000,
	CHANNEL_MID_VALUE = 1500,
	CHANNEL_MAX_VALUE = 2000,
	CHANNEL_RNG_VALUE = CHANNEL_MAX_VALUE - CHANNEL_MIN_VALUE,

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
	rate: 0.3,
	accOK: false,
	accEn: false,
	acc: [0,0,0],
	accBase: [0,0,0],
	accelerometerID: null,
	last_received_acc_timestamp: 0,
	last_received_timestamp: 0,
	last_send_timestamp: 0
}
var SAVE = {
	url: 'tcp://192.168.4.1:2323',
	droneCh: 'TREA1234',
	ctrlCh: 'TREA',
	autoCenter: [0,1],
	aux: [
		[1100,1900],
		[1100,1900],
		[1100,1900],
		[1100,1900]
	],
	rates: [0.3, 0.6, 1.0],
	gyroCtrl: [0,0],
	maxAng: 60,
	yawDeadband: 0.2,
	trim: {
		A: 0,
		E: 0,
		R: 0,
		T: 0
	}
}
var transmitTimer = null;


document.addEventListener('deviceready', function(e){
	console.log('onDeviceready1', e, navigator.accelerometer)
	if(navigator.accelerometer){
		var startAcc = function(e){
			console.log('onResume', e)
			if(STATUS.accelerometerID) navigator.accelerometer.clearWatch(STATUS.accelerometerID)
			STATUS.accelerometerID = navigator.accelerometer.watchAcceleration(updateAHRS, null, {frequency: 25})
			STATUS.last_received_acc_timestamp = Date.now()
		}
		startAcc()

		document.addEventListener('pause', function(e){
			console.log('onPause', e)
			navigator.accelerometer.clearWatch(STATUS.accelerometerID)
			STATUS.accelerometerID = null
		}, false)
		document.addEventListener('resume', startAcc, false)
	}
}, false)
document.addEventListener('pause', saveConfig, false)

$(document).ready(function() {
console.log('onDocumentReady')

	loadConfig()
	updateConfig()
	updateConfigUI()

	gimbalElems = [$('.control-gimbal.left'),$('.control-gimbal.right')]
	gimbalSize = $(gimbalElems[0]).height()

	for(var i=0; i<gimbalElems.length; i++){
		(function(ele, i){
			var tid = null;
			ele.on('touchstart mousedown', function(e) {
				e.preventDefault()

				// has enable gyroCtrl
				if(STATUS.accOK && SAVE.gyroCtrl[i]){
					var a = STATUS.acc
					STATUS.accBase = [ a[0], a[1], a[2] ]
					STATUS.accEn = true
					return
				}

				// else use touch
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

				STATUS.accEn = false

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

	$(document).on('click', function(e){
//		console.log(e.target, $(e.target).hasClass('modal'))
		var target = $(e.target)
		if(target.hasClass('modal')){
			target.hide()
		}
	})

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

	$('#adjustModal span.close').on('click', function(e){
		$('#adjustModal').hide()
	})
	$('#adjusticon').on('click', function(e){
		$('#adjustModal').show()
	})

	$('#accCalibrationBtn').on('click', function(e){
		if(STATUS.connected){
			// TODO: some UI respone
			MSP.send_message(MSPCodes.MSP_ACC_CALIBRATION, false, false)
		}
	})
	$('#magCalibrationBtn').on('click', function(e){
		if(STATUS.connected){
			// TODO: some UI respone
			MSP.send_message(MSPCodes.MSP_MAG_CALIBRATION, false, false)
		}
	})
	$('#rstTrimBtn').on('click', function(e){
		SAVE.trim = {
			A: 0,
			E: 0,
			R: 0,
			T: 0
		}
		saveConfig()
		updateConfigUI()
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
				saveConfig()

				// TODO: some UI respone when connecting
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

		var gyroCtrl = [0,0]
		gyroCtrl[0] = ($('#lgyro').is(":checked")) ? 1 : 0;
		gyroCtrl[1] = ($('#rgyro').is(":checked")) ? 1 : 0;
		SAVE.gyroCtrl = gyroCtrl

		var maxAng = parseFloat($('#maxAng').val()) || 60
		SAVE.maxAng = (maxAng < 10)? 10.0 : ( (maxAng > 85)? 85 : maxAng )

		var yawDeadband = parseFloat($('#yawDeadband').val()) || 0.2
		SAVE.yawDeadband = (yawDeadband < 0)? 0 : ( (yawDeadband > 0.95)? 0.95 : yawDeadband )

		var rates = $('#rates').val().split(',')
		for(var i=0; i<rates.length; i++){
			rates[i] = parseFloat(rates[i]) || 0.3
		}
		SAVE.rates = rates

		var auxs = $('#configAUX > input')
		var aux = []
		for(var i=0; i<auxs.length; i++){
			var vals = $(auxs[i]).val().split(',')
			for(var j=0; j<vals.length; j++){
				vals[j] = parseInt(vals[j]) || 1500
			}
			aux.push(vals)
		}
		SAVE.aux = aux

		saveConfig()

		updateConfig()
		updateConfigUI()
		$('#configModal').hide()
	})

	var rateClicks = 1;
	var rateBtn = $('#rateBtn')
	rateBtn.text('rate: ' + Math.round(STATUS.rate * 100) + '%')
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
			var color = ['success', 'info', 'warning', 'danger']
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

	$('.btn.trim').on('click touchend', function(e){
		if(('ontouchstart' in window) && (e.type == 'click')){
			return false
		}

		var ctrlCh = SAVE.ctrlCh
		var ele = $(this)
		var mapto = parseInt(ele.attr('map'))
		var val = SAVE.trim[ctrlCh[mapto]] += parseInt(ele.attr('adj'))
		var ui = ele.parent().find('.trim.value')
		ui.text(val)
//		console.log('trim adj', ui, ctrlCh[mapto], SAVE.trim)
	})
})

function loadConfig() {
	var conf = JSON.parse(window.localStorage.getItem('SAVE'))
	if(conf){
		SAVE = conf
	}

	if(!SAVE.trim){
		SAVE.trim = {
			A: 0,
			E: 0,
			R: 0,
			T: 0
		}
	}
}

function saveConfig() {
	console.log('SAVE', SAVE)
	window.localStorage.setItem('SAVE', JSON.stringify(SAVE))
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

function updateConfigUI() {
	$('#droneCh').val(SAVE.droneCh)
	$('#ctrlCh').val(SAVE.ctrlCh)
	$('#connectUrl').val(SAVE.url)
	$('#maxAng').val(SAVE.maxAng)
	$('#yawDeadband').val(SAVE.yawDeadband)

	$('#lauto').attr('checked', !!(SAVE.autoCenter[0]))
	$('#rauto').attr('checked', !!(SAVE.autoCenter[1]))
	$('#lgyro').attr('checked', !!(SAVE.gyroCtrl[0]))
	$('#rgyro').attr('checked', !!(SAVE.gyroCtrl[1]))

	$('#rates').val(SAVE.rates.join(','))

	var auxs = $('#configAUX > input')
	for(var i=0; i<auxs.length; i++){
		$(auxs[i]).val(SAVE.aux[i].join(','))
	}

	var ctrlCh = SAVE.ctrlCh
	var trimValueUI = $('.trim.value')
	for(var i=0; i<trimValueUI.length; i++){
		var ele = $(trimValueUI[i])
		var mapto = parseInt(ele.attr('map'))
		ele.text(SAVE.trim[ctrlCh[mapto]])
	}
}

function updateUI() {
	// has enable gyroCtrl
	if(STATUS.accOK && STATUS.accEn){
		for(var i=0; i<gimbalElems.length; i++){
			if(SAVE.gyroCtrl[i]){
				// calc delta rotate
				var qDelta = [0,0,0,0]
				accRot(STATUS.accBase, STATUS.acc, qDelta)

				var rpy = [0,0,0]
				q2euler(qDelta, rpy)
//console.log('qDelta', qDelta)
//console.log('rpyDelta', rpy)

				var scale = CHANNEL_RNG_VALUE / (SAVE.maxAng * 2)
				var r = rpy[0] * scale + CHANNEL_MID_VALUE
				var p = rpy[1] * scale + CHANNEL_MID_VALUE
				stickValues[gimbals[i][0]] = Math.min(Math.max(p, CHANNEL_MIN_VALUE), CHANNEL_MAX_VALUE)
				stickValues[gimbals[i][1]] = Math.min(Math.max(r, CHANNEL_MIN_VALUE), CHANNEL_MAX_VALUE)
			}
		}
	}
	updateControlPositions()

	var active = ((Date.now() - STATUS.last_received_timestamp) < 500);
	if(active){
		$('.linkicon').addClass('active')
	}else{
		$('.linkicon').removeClass('active')
	}

	window.requestAnimationFrame(updateUI)
}

function updateAHRS(acc) {
	var dt = (Date.now() - STATUS.last_received_acc_timestamp) / 1000.0
	STATUS.last_received_acc_timestamp = Date.now()

// TODO: some better low pass filter
	var oldAcc = STATUS.acc
	var ax = acc.x
	var ay = acc.y
	var az = acc.z
	var len = Math.sqrt(ax*ax + ay*ay + az*az) / 9.81
	if((len > 0.7) && (len < 1.3)){
		oldAcc[0] = oldAcc[0] * 0.35 + ax * 0.65
		oldAcc[1] = oldAcc[1] * 0.35 + ay * 0.65
		oldAcc[2] = oldAcc[2] * 0.35 + az * 0.65
		STATUS.accOK = true
	}
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

	return Math.round(portion * (CHANNEL_RNG_VALUE) + CHANNEL_MIN_VALUE);
}

function channelValueToStickPortion(channel) {
	return (channel - CHANNEL_MIN_VALUE) / (CHANNEL_RNG_VALUE);
}

function updateControlPositions() {
	for (var stickName in stickValues) {
		var stickValue = stickValues[stickName];

		// Look for the gimbal which corresponds to this stick name
		for (var gimbalIndex in gimbals) {
			var gimbal = gimbals[gimbalIndex]
			var gimbalElem = gimbalElems[gimbalIndex]
			var stickElem = $($('.control-stick')[gimbalIndex])

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

	for (var stickName in stickValues) {
		var val = stickValues[stickName]

		// only roll & pitch
		if((stickName == 'E')||(stickName == 'A')){
			val = Math.round((val - CHANNEL_MID_VALUE) * STATUS.rate + CHANNEL_MID_VALUE)
		}

		// yaw deadband
		if(stickName == 'R'){
			var yval = val - CHANNEL_MID_VALUE
			var valabs = Math.abs(yval)
			var deadband = CHANNEL_RNG_VALUE * SAVE.yawDeadband
			if(valabs > deadband){
				if(yval < 0){
					val = -(valabs - deadband)
				} else {
					val = (valabs - deadband)
				}
			} else {
				val = 0
			}
			val += CHANNEL_MID_VALUE
		}

		if(SAVE.trim[stickName]){
			val += SAVE.trim[stickName]
		}

		channelValues[channelMSPIndexes[stickName]] = val;
	}

	mspHelper.setRawRx(channelValues)

	transmitTimer = setTimeout(transmitChannels, 25)
}

function update_packet_error(caller) {
// TODO: show packet_error `caller.packet_error`
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
								//onConnect();
								MSP.send_message(MSPCodes.MSP_RX_MAP, false, false, function () {
									console.log('MSP_RX_MAP:', CONFIG.RC_MAP);

									SAVE.droneCh = CONFIG.RC_MAP
									updateConfig()
									updateConfigUI()
									onConnect();
								});
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
		console.log('connectionClosedOk')
	} else { // Something went wrong
		console.log('connectionClosedFail')
	}

	$('#rxicon').removeClass('active')
	$('.armedicon').removeClass('active')
	$('.failsafeicon').removeClass('active')
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
				$('.armedicon').addClass('active')
			else
				$('.armedicon').removeClass('active')
		}
		if (AUX_CONFIG[i] == 'FAILSAFE') {
			if (bit_check(CONFIG.mode, i))
				$('.failsafeicon').addClass('active')
			else
				$('.failsafeicon').removeClass('active')
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

	var ping = STATUS.ping = STATUS.last_received_timestamp - STATUS.last_send_timestamp
	$('#ping').text('ping: ' + ping)

	setTimeout(function(){
		if(!STATUS.connected) return
		MSP.send_message(MSPCodes.MSP_BOXNAMES, false, false)
		// BTFL >= "2.9.1"
		MSP.send_message(MSPCodes.MSP_STATUS_EX, false, false, updateLiveStats)
		// else
//		MSP.send_message(MSPCodes.MSP_STATUS, false, false);

		STATUS.last_send_timestamp = Date.now()
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

