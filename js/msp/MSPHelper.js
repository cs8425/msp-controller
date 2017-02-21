'use strict';


function MspHelper () {
  var self = this;

  // 0 based index, must be identical to 'baudRates' in 'src/main/io/serial.c' in betaflight
  self.BAUD_RATES = ['AUTO', '9600', '19200', '38400', '57600', '115200',
    '230400', '250000', '400000', '460800', '500000', '921600', '1000000',
    '1500000', '2000000', '2470000'];
  // needs to be identical to 'serialPortFunction_e' in 'src/main/io/serial.h' in betaflight
  self.SERIAL_PORT_FUNCTIONS = {
    'MSP': 0,
    'GPS': 1,
    'TELEMETRY_FRSKY': 2,
    'TELEMETRY_HOTT': 3,
    'TELEMETRY_MSP': 4,
    'TELEMETRY_LTM': 4, // LTM replaced MSP
    'TELEMETRY_SMARTPORT': 5,
    'RX_SERIAL': 6,
    'BLACKBOX': 7,
    'TELEMETRY_MAVLINK': 9,
    'ESC_SENSOR': 10,
    'TBS_SMARTAUDIO': 11,
    'TELEMETRY_IBUS': 12,
    'IRC_TRAMP': 13
  };
}

MspHelper.prototype.process_data = function(dataHandler) {
    var self = this;

    var data = dataHandler.dataView; // DataView (allowing us to view arrayBuffer as struct/union)
    var code = dataHandler.code;
    var crcError = dataHandler.crcError;
    if (!crcError) {
        if (!dataHandler.unsupported) switch (code) {
            case MSPCodes.MSP_STATUS:
                CONFIG.cycleTime = data.readU16();
                CONFIG.i2cError = data.readU16();
                CONFIG.activeSensors = data.readU16();
                CONFIG.mode = data.readU32();
                CONFIG.profile = data.readU8();
                break;
            case MSPCodes.MSP_STATUS_EX:
                CONFIG.cycleTime = data.readU16();
                CONFIG.i2cError = data.readU16();
                CONFIG.activeSensors = data.readU16();
                CONFIG.mode = data.readU32();
                CONFIG.profile = data.readU8();
                CONFIG.cpuload = data.readU16();
                // > "2.9.1"
                    CONFIG.numProfiles = data.readU8();
                    CONFIG.rateProfile = data.readU8();
                break;
    
            /*case MSPCodes.MSP_RAW_IMU:
                // 512 for mpu6050, 256 for mma
                // currently we are unable to differentiate between the sensor types, so we are goign with 512
                SENSOR_DATA.accelerometer[0] = data.read16() / 512;
                SENSOR_DATA.accelerometer[1] = data.read16() / 512;
                SENSOR_DATA.accelerometer[2] = data.read16() / 512;
    
                // properly scaled
                SENSOR_DATA.gyroscope[0] = data.read16() * (4 / 16.4);
                SENSOR_DATA.gyroscope[1] = data.read16() * (4 / 16.4);
                SENSOR_DATA.gyroscope[2] = data.read16() * (4 / 16.4);
    
                // no clue about scaling factor
                SENSOR_DATA.magnetometer[0] = data.read16() / 1090;
                SENSOR_DATA.magnetometer[1] = data.read16() / 1090;
                SENSOR_DATA.magnetometer[2] = data.read16() / 1090;
                break;
            case MSPCodes.MSP_DEBUG:
                for (var i = 0; i < 4; i++)
                    SENSOR_DATA.debug[i] = data.read16();
                break;
            case MSPCodes.MSP_SERVO:
                var servoCount = data.byteLength / 2;
                for (var i = 0; i < servoCount; i++) {
                    SERVO_DATA[i] = data.readU16();
                }
                break;
            case MSPCodes.MSP_MOTOR:
                var motorCount = data.byteLength / 2;
                for (var i = 0; i < motorCount; i++) {
                    MOTOR_DATA[i] = data.readU16();
                }
                break;
            case MSPCodes.MSP_RC:
                RC.active_channels = data.byteLength / 2;
                for (var i = 0; i < RC.active_channels; i++) {
                    RC.channels[i] = data.readU16();
                }
                break;
            case MSPCodes.MSP_RAW_GPS:
                GPS_DATA.fix = data.readU8();
                GPS_DATA.numSat = data.readU8();
                GPS_DATA.lat = data.read32();
                GPS_DATA.lon = data.read32();
                GPS_DATA.alt = data.readU16();
                GPS_DATA.speed = data.readU16();
                GPS_DATA.ground_course = data.readU16();
                break;
            case MSPCodes.MSP_COMP_GPS:
                GPS_DATA.distanceToHome = data.readU16();
                GPS_DATA.directionToHome = data.readU16();
                GPS_DATA.update = data.readU8();
                break;
            case MSPCodes.MSP_ATTITUDE:
                SENSOR_DATA.kinematics[0] = data.read16() / 10.0; // x
                SENSOR_DATA.kinematics[1] = data.read16() / 10.0; // y
                SENSOR_DATA.kinematics[2] = data.read16(); // z
                break;
            case MSPCodes.MSP_ALTITUDE:
                SENSOR_DATA.altitude = parseFloat((data.read32() / 100.0).toFixed(2)); // correct scale factor
                break;
            case MSPCodes.MSP_SONAR:
                SENSOR_DATA.sonar = data.read32();
                break;
            case MSPCodes.MSP_ANALOG:
                ANALOG.voltage = data.readU8() / 10.0;
                ANALOG.mAhdrawn = data.readU16();
                ANALOG.rssi = data.readU16(); // 0-1023
                ANALOG.amperage = data.read16() / 100; // A
                ANALOG.last_received_timestamp = Date.now();
                break;
            case MSPCodes.MSP_PID:
                // PID data arrived, we need to scale it and save to appropriate bank / array
                for (var i = 0, needle = 0; i < (data.byteLength / 3); i++, needle += 3) {
                    // main for loop selecting the pid section
                    for (var j = 0; j < 3; j++) {
                        PIDs[i][j] = data.readU8();
                    }
                }
                break;
            case MSPCodes.MSP_SET_MOTOR:
                console.log('Motor Speeds Updated');
                break;*/
            case MSPCodes.MSP_BOXNAMES:
                AUX_CONFIG = []; // empty the array as new data is coming in
    
                var buff = [];
                for (var i = 0; i < data.byteLength; i++) {
                    var char = data.readU8();
                    if (char == 0x3B) { // ; (delimeter char)
                        AUX_CONFIG.push(String.fromCharCode.apply(null, buff)); // convert bytes into ASCII and save as strings
    
                        // empty buffer
                        buff = [];
                    } else {
                        buff.push(char);
                    }
                }
                break;
            case MSPCodes.MSP_PIDNAMES:
                PID_names = []; // empty the array as new data is coming in
    
                var buff = [];
                for (var i = 0; i < data.byteLength; i++) {
                    var char = data.readU8();
                    if (char == 0x3B) { // ; (delimeter char)
                        PID_names.push(String.fromCharCode.apply(null, buff)); // convert bytes into ASCII and save as strings
    
                        // empty buffer
                        buff = [];
                    } else {
                        buff.push(char);
                    }
                }
                break;
            case MSPCodes.MSP_BOXIDS:
                AUX_CONFIG_IDS = []; // empty the array as new data is coming in
    
                for (var i = 0; i < data.byteLength; i++) {
                    AUX_CONFIG_IDS.push(data.readU8());
                }
                break;


/*            case MSPCodes.MSP_MISC: // 22 bytes
                RX_CONFIG.midrc = data.readU16();
                MISC.minthrottle = data.readU16(); // 0-2000
                MISC.maxthrottle = data.readU16(); // 0-2000
                MISC.mincommand = data.readU16(); // 0-2000
                MISC.failsafe_throttle = data.readU16(); // 1000-2000
                MISC.gps_type = data.readU8();
                MISC.gps_baudrate = data.readU8();
                MISC.gps_ubx_sbas = data.readU8();
                MISC.multiwiicurrentoutput = data.readU8();
                MISC.rssi_channel = data.readU8();
                MISC.placeholder2 = data.readU8();
                if (semver.lt(CONFIG.apiVersion, "1.18.0"))
                    MISC.mag_declination = data.read16() / 10; // -1800-1800
                else
                    MISC.mag_declination = data.read16() / 100; // -18000-18000
                MISC.vbatscale = data.readU8(); // 10-200
                MISC.vbatmincellvoltage = data.readU8() / 10; // 10-50
                MISC.vbatmaxcellvoltage = data.readU8() / 10; // 10-50
                MISC.vbatwarningcellvoltage = data.readU8() / 10; // 10-50
                break;

            case MSPCodes.MSP_RC_DEADBAND:
                RC_deadband.deadband = data.readU8();
                RC_deadband.yaw_deadband = data.readU8();
                RC_deadband.alt_hold_deadband = data.readU8();
                break;
            case MSPCodes.MSP_SENSOR_ALIGNMENT:
                SENSOR_ALIGNMENT.align_gyro = data.readU8();
                SENSOR_ALIGNMENT.align_acc = data.readU8();
                SENSOR_ALIGNMENT.align_mag = data.readU8();
                break;*/
            case MSPCodes.MSP_SET_RAW_RC:
                break;
            case MSPCodes.MSP_SET_PID:
                console.log('PID settings saved');
                break;
            case MSPCodes.MSP_ACC_CALIBRATION:
                console.log('Accel calibration executed');
                break;
            case MSPCodes.MSP_MAG_CALIBRATION:
                console.log('Mag calibration executed');
                break;
            case MSPCodes.MSP_SET_MISC:
                console.log('MISC Configuration saved');
                break;
            case MSPCodes.MSP_RESET_CONF:
                console.log('Settings Reset');
                break;
            case MSPCodes.MSP_SELECT_SETTING:
                console.log('Profile selected');
                break;

            case MSPCodes.MSP_UID:
                CONFIG.uid[0] = data.readU32();
                CONFIG.uid[1] = data.readU32();
                CONFIG.uid[2] = data.readU32();
                break;
            case MSPCodes.MSP_ACC_TRIM:
                CONFIG.accelerometerTrims[0] = data.read16(); // pitch
                CONFIG.accelerometerTrims[1] = data.read16(); // roll
                break;
            case MSPCodes.MSP_SET_ACC_TRIM:
                console.log('Accelerometer trimms saved.');
                break;
    
            case MSPCodes.MSP_RX_MAP:
                RC_MAP = []; // empty the array as new data is coming in
    
                for (var i = 0; i < data.byteLength; i++) {
                    RC_MAP.push(data.readU8());
                }

                // handle rcmap & rssi aux channel
                var RC_MAP_Letters = ['A', 'E', 'R', 'T', '1', '2', '3', '4'];
                var strBuffer = [];
                for (var i = 0; i < RC_MAP.length; i++) {
                    strBuffer[RC_MAP[i]] = RC_MAP_Letters[i];
                }

                // reconstruct
                //var str = strBuffer.join('');
                CONFIG.RC_MAP = strBuffer.join('')

                break;
            case MSPCodes.MSP_SET_RX_MAP:
                console.log('RCMAP saved');
                break;

            case MSPCodes.MSP_SET_REBOOT:
                console.log('Reboot request accepted');
                break;
    
            case MSPCodes.MSP_API_VERSION:
                CONFIG.mspProtocolVersion = data.readU8();
                CONFIG.apiVersion = data.readU8() + '.' + data.readU8() + '.0';
                break;
    
            case MSPCodes.MSP_FC_VARIANT:
                var identifier = '';
                for (var i = 0; i < 4; i++) {
                    identifier += String.fromCharCode(data.readU8());
                }
                CONFIG.flightControllerIdentifier = identifier;
                break;
    
            case MSPCodes.MSP_FC_VERSION:
                CONFIG.flightControllerVersion = data.readU8() + '.' + data.readU8() + '.' + data.readU8();
                break;
    
            case MSPCodes.MSP_BUILD_INFO:
                var dateLength = 11;
                var buff = [];
                for (var i = 0; i < dateLength; i++) {
                    buff.push(data.readU8());
                }
                buff.push(32); // ascii space
    
                var timeLength = 8;
                for (var i = 0; i < timeLength; i++) {
                    buff.push(data.readU8());
                }
                CONFIG.buildInfo = String.fromCharCode.apply(null, buff);
                break;
    
            case MSPCodes.MSP_BOARD_INFO:
                var identifier = '';
                for (var i = 0; i < 4; i++) {
                    identifier += String.fromCharCode(data.readU8());
                }
                CONFIG.boardIdentifier = identifier;
                CONFIG.boardVersion = data.readU16();
                break;
    
            case MSPCodes.MSP_NAME:
                CONFIG.name = '';
                var char;
                while ((char = data.readU8()) !== null) {
                    CONFIG.name += String.fromCharCode(char);
                }
                break;

            default:
                console.log('Unknown code detected: ' + code);
        } else {
            console.log('FC reports unsupported message error: ' + code);
        }
    }
    // trigger callbacks, cleanup/remove callback after trigger
    for (var i = dataHandler.callbacks.length - 1; i >= 0; i--) { // itterating in reverse because we use .splice which modifies array length
        if (dataHandler.callbacks[i].code == code) {
            // save callback reference
            var callback = dataHandler.callbacks[i].callback;
            var callbackOnError = dataHandler.callbacks[i].callbackOnError;

            // remove timeout
            clearInterval(dataHandler.callbacks[i].timer);

            // remove object from array
            dataHandler.callbacks.splice(i, 1);
            if (!crcError || callbackOnError) {
                // fire callback
                if (callback) callback({'command': code, 'data': data, 'length': data.byteLength, 'crcError': crcError});
            }
        }
    }
}


/**
 * Set raw Rx values over MSP protocol.
 *
 * Channels is an array of 16-bit unsigned integer channel values to be sent. 8 channels is probably the maximum.
 */
MspHelper.prototype.setRawRx = function(channels) {
    var buffer = [];

    for (var i = 0; i < channels.length; i++) {
        buffer.push16(channels[i]);
    }

    MSP.send_message(MSPCodes.MSP_SET_RAW_RC, buffer, false);
}


