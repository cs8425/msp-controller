'use strict';

var MSP = {
    state:                      0,
    message_direction:          1,
    code:                       0,
    dataView:                   0,
    message_length_expected:    0,
    message_length_received:    0,
    message_buffer:             null,
    message_buffer_uint8_view:  null,
    message_checksum:           0,
    messageIsJumboFrame:        false,
    crcError:                   false,

    callbacks:                  [],
    packet_error:               0,
    unsupported:                0,

    last_received_timestamp:   null,
    listeners:                  [],

    JUMBO_FRAME_SIZE_LIMIT:     255,

    timeout:                    1000,
    
    read: function (readInfo) {
        var self = this;
        var data = new Uint8Array(readInfo.data);

        for (var i = 0; i < data.length; i++) {
            switch (self.state) {
                case 0: // sync char 1
                    if (data[i] == 36) { // $
                        self.state++;
                    }
                    break;
                case 1: // sync char 2
                    if (data[i] == 77) { // M
                        self.state++;
                    } else { // restart and try again
                        self.state = 0;
                    }
                    break;
                case 2: // direction (should be >)
                    self.unsupported = 0;
                    if (data[i] == 62) { // >
                        self.message_direction = 1;
                    } else if (data[i] == 60) { // <
                        self.message_direction = 0;
                    } else if (data[i] == 33) { // !
                        // FC reports unsupported message error
                        self.unsupported = 1;
                    }

                    self.state++;
                    break;
                case 3:
                    self.message_length_expected = data[i];
                    if (self.message_length_expected === self.JUMBO_FRAME_SIZE_LIMIT) {
                        self.messageIsJumboFrame = true;
                    }

                    self.message_checksum = data[i];

                    self.state++;
                    break;
                case 4:
                    self.code = data[i];
                    self.message_checksum ^= data[i];

                    if (self.message_length_expected > 0) {
                        // process payload
                        if (self.messageIsJumboFrame) {
                            self.state++;
                        } else {
                            self.state = self.state + 3;
                        }
                    } else {
                        // no payload
                        self.state += 5;
                    }
                    break;
                case 5:
                    self.message_length_expected = data[i];

                    self.message_checksum ^= data[i];

                    self.state++;

                    break;
                case 6:
                    self.message_length_expected = self.message_length_expected  + 256 * data[i];

                    self.message_checksum ^= data[i];

                    self.state++;

                    break;
                case 7:
                    // setup arraybuffer
                    self.message_buffer = new ArrayBuffer(self.message_length_expected);
                    self.message_buffer_uint8_view = new Uint8Array(self.message_buffer);

                    self.state++;
                case 8: // payload
                    self.message_buffer_uint8_view[self.message_length_received] = data[i];
                    self.message_checksum ^= data[i];
                    self.message_length_received++;

                    if (self.message_length_received >= self.message_length_expected) {
                        self.state++;
                    }
                    break;
                case 9:
                    if (self.message_checksum == data[i]) {
                        // message received, store dataview
                        self.dataView = new DataView(self.message_buffer, 0, self.message_length_expected);
                    } else {
                        console.log('code: ' + self.code + ' - crc failed');
                        self.packet_error++;
                        self.crcError = true;
                        self.dataView = new DataView(new ArrayBuffer(0));
                    }
                    // Reset variables
                    self.message_length_received = 0;
                    self.state = 0;
                    self.messageIsJumboFrame = false;
                    self.notify();
                    self.crcError = false;
                    break;

                default:
                    console.log('Unknown state detected: ' + self.state);
            }
        }
        self.last_received_timestamp = Date.now();
    },
    notify: function() {
        var self = this;
        self.listeners.forEach(function(listener) {
            listener(self);
        });
    },
    listen: function(listener) {
        var self = this;
        if (self.listeners.indexOf(listener) == -1) {
            self.listeners.push(listener);
        }
    },
    clearListeners: function() {
        var self = this;
        self.listeners = [];
    },
    send_message: function (code, data, callback_sent, callback_msp, callback_onerror) {
        var self = this;
        var bufferOut,
            bufView;

         if (!callback_onerror) {
             var callbackOnError = false;
         } else {
             var callbackOnError = true;
         }
        // always reserve 6 bytes for protocol overhead !
        if (data) {
            var size = data.length + 6,
                checksum = 0;

            bufferOut = new ArrayBuffer(size);
            bufView = new Uint8Array(bufferOut);

            bufView[0] = 36; // $
            bufView[1] = 77; // M
            bufView[2] = 60; // <
            bufView[3] = data.length;
            bufView[4] = code;

            checksum = bufView[3] ^ bufView[4];

            for (var i = 0; i < data.length; i++) {
                bufView[i + 5] = data[i];

                checksum ^= bufView[i + 5];
            }

            bufView[5 + data.length] = checksum;
        } else {
            bufferOut = new ArrayBuffer(6);
            bufView = new Uint8Array(bufferOut);

            bufView[0] = 36; // $
            bufView[1] = 77; // M
            bufView[2] = 60; // <
            bufView[3] = 0; // data length
            bufView[4] = code; // code
            bufView[5] = bufView[3] ^ bufView[4]; // checksum
        }

        var obj = {'code': code, 'requestBuffer': bufferOut, 'callback': (callback_msp) ? callback_msp : false, 'timer': false, 'callbackOnError': callbackOnError};

        var requestExists = false;
        for (var i = 0; i < MSP.callbacks.length; i++) {
            if (MSP.callbacks[i].code == code) {
                // request already exist, we will just attach
                requestExists = true;
                break;
            }
        }

        if (!requestExists) {
            obj.timer = setInterval(function () {
                console.log('MSP data request timed-out: ' + code);

                serial.send(bufferOut, false);
            }, self.timeout); // we should be able to define timeout in the future
        }

        MSP.callbacks.push(obj);

        // always send messages with data payload (even when there is a message already in the queue)
        if (data || !requestExists) {
            serial.send(bufferOut, function (sendInfo) {
                if (sendInfo.bytesSent == bufferOut.byteLength) {
                    if (callback_sent) callback_sent();
                }
            });
        }

        return true;
    },
    /**
     * resolves: {command: code, data: data, length: message_length}
     */
    promise: function(code, data) {
      var self = this;
      return new Promise(function(resolve) {
        self.send_message(code, data, false, function(data) {
          resolve(data);
        });
      });
    },
    callbacks_cleanup: function () {
        var self = this;
        for (var i = 0; i < self.callbacks.length; i++) {
            clearInterval(self.callbacks[i].timer);
        }

        self.callbacks = [];
    },
    disconnect_cleanup: function () {
        var self = this;
        self.state = 0; // reset packet state for "clean" initial entry (this is only required if user hot-disconnects)
        self.packet_error = 0; // reset CRC packet error counter for next session

        self.callbacks_cleanup();
    }
};
