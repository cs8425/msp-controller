//=====================================================================================================
// MahonyAHRS.c
//=====================================================================================================
//
// Madgwick's implementation of Mayhony's AHRS algorithm.
// See: http://www.x-io.co.uk/node/8#open_source_ahrs_and_imu_algorithms
//
// Date         Author          Notes
// 29/09/2011   SOH Madgwick    Initial release
// 02/10/2011   SOH Madgwick    Optimised for reduced CPU load
//
//=====================================================================================================
// javascript version from: https://github.com/ZiCog/madgwick.js
//

"use strict";

//---------------------------------------------------------------------------------------------------
// Definitions

var twoKpDef   = 2.0 * 50.0;         // 2 * proportional gain
var twoKiDef   = 2.0 * 0.0;         // 2 * integral gain
//var twoKpDef   = 100.0 * 0.5;         // 2 * proportional gain
//var twoKiDef   = 10.0 * 0.0;         // 2 * integral gain

//---------------------------------------------------------------------------------------------------
// Variable definitions

var twoKp = twoKpDef;                                                       // 2 * proportional gain (Kp)
var twoKi = twoKiDef;                                                       // 2 * integral gain (Ki)
var integralFBx = 0.0, integralFBy = 0.0, integralFBz = 0.0;                // integral error terms scaled by Ki

//====================================================================================================
// Functions

//---------------------------------------------------------------------------------------------------
// IMU algorithm update
//
// q = [q0, q1, q2, q3] (w, x, y, z)
// acc = {x, y, z}
// dt = s (1.0 / Hz)
function mahonyAHRSupdateIMU(q, acc, dt) {
	var q0 = q[0]
	var q1 = q[1]
	var q2 = q[2]
	var q3 = q[3]

	var gx = 0
	var gy = 0
	var gz = 0

	var ax = acc.x
	var ay = acc.y
	var az = acc.z

    var recipNorm;
    var halfvx, halfvy, halfvz;
    var halfex, halfey, halfez;
    var qa, qb, qc;

    // Compute feedback only if accelerometer measurement valid (afunctions NaN in accelerometer normalisation)
    if (!((ax === 0.0) && (ay === 0.0) && (az === 0.0))) {
        // Normalise accelerometer measurement
        recipNorm = Math.pow(ax * ax + ay * ay + az * az, -0.5);
        ax *= recipNorm;
        ay *= recipNorm;
        az *= recipNorm;

        // Estimated direction of gravity and vector perpendicular to magnetic flux
        halfvx = q1 * q3 - q0 * q2;
        halfvy = q0 * q1 + q2 * q3;
        halfvz = q0 * q0 - 0.5 + q3 * q3;

        // Error is sum of cross product between estimated and measured direction of gravity
        halfex = (ay * halfvz - az * halfvy);
        halfey = (az * halfvx - ax * halfvz);
        halfez = (ax * halfvy - ay * halfvx);

        // Compute and apply integral feedback if enabled
        if (twoKi > 0.0) {
            integralFBx += twoKi * halfex * dt; // integral error scaled by Ki
            integralFBy += twoKi * halfey * dt;
            integralFBz += twoKi * halfez * dt;
            gx += integralFBx; // apply integral feedback
            gy += integralFBy;
            gz += integralFBz;
        } else {
            integralFBx = 0.0; // prevent integral windup
            integralFBy = 0.0;
            integralFBz = 0.0;
        }
        // Apply proportional feedback
        gx += twoKp * halfex;
        gy += twoKp * halfey;
        gz += twoKp * halfez;
    }

    // Integrate rate of change of quaternion
    gx *= (0.5 * dt);         // pre-multiply common factors
    gy *= (0.5 * dt);
    gz *= (0.5 * dt);
    qa = q0;
    qb = q1;
    qc = q2;
    q0 += (-qb * gx - qc * gy - q3 * gz);
    q1 += (qa * gx + qc * gz - q3 * gy);
    q2 += (qa * gy - qb * gz + q3 * gx);
    q3 += (qa * gz + qb * gy - qc * gx);

    // Normalise quaternion
    recipNorm = Math.pow(q0 * q0 + q1 * q1 + q2 * q2 + q3 * q3, -0.5);
    q0 *= recipNorm;
    q1 *= recipNorm;
    q2 *= recipNorm;
    q3 *= recipNorm;

	q[0] = q0
	q[1] = q1
	q[2] = q2
	q[3] = q3
}

// from https://github.com/mrdoob/three.js/blob/dev/src/math/Quaternion.js
function q_length(q) {
	return Math.sqrt( q[3] * q[3] + q[0] * q[0] + q[1] * q[1] + q[2] * q[2] )
}

function q_normalize(q, qout) {
	var l = q_length(q)

	if(l === 0){
		qout[0] = 1
		qout[1] = 0
		qout[2] = 0
		qout[3] = 0
	}else{
		l = 1/l

		qout[0] = q[0] * l
		qout[1] = q[1] * l
		qout[2] = q[2] * l
		qout[3] = q[3] * l
	}

	return qout
}

function q_multiply(a, b, qout) {
// from http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/code/index.htm

	var qax = a[1], qay = a[2], qaz = a[3], qaw = a[0];
	var qbx = b[1], qby = b[2], qbz = b[3], qbw = b[0];

	qout[1] = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
	qout[2] = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
	qout[3] = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
	qout[0] = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;

	return qout
}


function q2euler(q, rpy) {
// rpy = [r, p, y]
// from https://en.wikipedia.org/wiki/Conversion_between_quaternions_and_Euler_angles#Quaternion_to_Euler_Angles_Conversion
	var qw = q[0]
	var qx = q[1]
	var qy = q[2]
	var qz = q[3]
	var RAD2DEG = 360.0 / Math.PI

	var ysqr = qy * qy

	// roll (x-axis rotation)
	var t0 = +2.0 * (qw * qx + qy * qz);
	var t1 = +1.0 - 2.0 * (qx * qx + ysqr);
	rpy[0] = Math.atan2(t0, t1) * RAD2DEG

	// pitch (y-axis rotation)
	var t2 = +2.0 * (qw * qy - qz * qx);
	t2 = t2 > 1.0 ? 1.0 : t2;
	t2 = t2 < -1.0 ? -1.0 : t2;
	rpy[1] = Math.asin(t2) * RAD2DEG

	// yaw (z-axis rotation)
	var t3 = +2.0 * (qw * qz + qx * qy);
	var t4 = +1.0 - 2.0 * (ysqr + qz * qz);
	rpy[2] = Math.atan2(t3, t4) * RAD2DEG

	return rpy
}

