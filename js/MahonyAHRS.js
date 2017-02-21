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

// q = [q0, q1, q2, q3] (w, x, y, z)
// acc = {x, y, z}
// dt = s (1.0 / Hz)
var last_acc = [0,0,0]
function myAHRSupdateIMU(q, acc, dt) {
	var q0 = q[0]
	var q1 = q[1]
	var q2 = q[2]
	var q3 = q[3]

	var ux = acc.x
	var uy = acc.y
	var uz = acc.z

	var vx = last_acc[0]
	var vy = last_acc[1]
	var vz = last_acc[2]

	var recipNorm

// from http://webcache.googleusercontent.com/search?q=cache:BhqKfm1NVhMJ:lolengine.net/blog/2014/02/24/quaternion-from-two-vectors-final+&cd=3&hl=zh-TW&ct=clnk&gl=tw
//	var norm_u_norm_v = Math.sqrt(dot(u, u) * dot(v, v));
//	var real_part = norm_u_norm_v + dot(u, v);
	var norm_u_norm_v = Math.sqrt((ux*ux + uy*uy + uz*uz) * (vx*vx + vy*vy + vz*vz))
	var w0 = norm_u_norm_v + (ux*vx + uy*vy + uz*vz);
	var w1, w2, w3

	if (w0 < 1.0e-6 * norm_u_norm_v) {
		/* If u and v are exactly opposite, rotate 180 degrees
		* around an arbitrary orthogonal axis. Axis normalisation
		* can happen later, when we normalise the quaternion. */
		w0 = 0.0;
//		w = abs(u.x) > abs(u.z) ? vec3(-u.y, u.x, 0.f) : vec3(0.f, -u.z, u.y);
		if(Math.abs(ux) > Math.abs(uz)){
			//w = [-uy, ux, 0]
			w1 = -uy
			w2 = ux
			w3 = 0
		}else{
			//w = [0, -uz, uy]
			w1 = 0
			w2 = -uz
			w3 = uy
		}
	}else{
		/* Otherwise, build quaternion the standard way. */
		//w = cross(u, v);
			w1 = uy*vz - vy*uz
			w2 = uz*vx - vz*ux
			w3 = ux*vy - vx*uy
	}

	// Normalise quaternion
	recipNorm = Math.pow(w0 * w0 + w1 * w1 + w2 * w2 + w3 * w3, -0.5);
	w0 *= recipNorm;
	w1 *= recipNorm;
	w2 *= recipNorm;
	w3 *= recipNorm;

	last_acc[0] = ux
	last_acc[1] = uy
	last_acc[2] = uz

	q_multiply(q, [w0, w1, w2, w3], q)
}

function accRot(v, u, qout) {
	var ux = u[0]
	var uy = u[1]
	var uz = u[2]

	var vx = v[0]
	var vy = v[1]
	var vz = v[2]

	var recipNorm

// from http://webcache.googleusercontent.com/search?q=cache:BhqKfm1NVhMJ:lolengine.net/blog/2014/02/24/quaternion-from-two-vectors-final+&cd=3&hl=zh-TW&ct=clnk&gl=tw
	var norm_u_norm_v = Math.sqrt((ux*ux + uy*uy + uz*uz) * (vx*vx + vy*vy + vz*vz))
	var w0 = norm_u_norm_v + (ux*vx + uy*vy + uz*vz);
	var w1, w2, w3

	if (w0 < 1.0e-6 * norm_u_norm_v) {
		/* If u and v are exactly opposite, rotate 180 degrees
		* around an arbitrary orthogonal axis. Axis normalisation
		* can happen later, when we normalise the quaternion. */
		w0 = 0.0;
//		w = abs(u.x) > abs(u.z) ? vec3(-u.y, u.x, 0.f) : vec3(0.f, -u.z, u.y);
		if(Math.abs(ux) > Math.abs(uz)){
			//w = [-uy, ux, 0]
			w1 = -uy
			w2 = ux
			w3 = 0
		}else{
			//w = [0, -uz, uy]
			w1 = 0
			w2 = -uz
			w3 = uy
		}
	}else{
		/* Otherwise, build quaternion the standard way. */
		//w = cross(u, v);
			w1 = uy*vz - vy*uz
			w2 = uz*vx - vz*ux
			w3 = ux*vy - vx*uy
	}

	// Normalise quaternion
	recipNorm = Math.pow(w0 * w0 + w1 * w1 + w2 * w2 + w3 * w3, -0.5);
	qout[0] = w0 * recipNorm;
	qout[1] = w1 * recipNorm;
	qout[2] = w2 * recipNorm;
	qout[3] = w3 * recipNorm;
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

/*
imuComputeRotationMatrix(void)
{
    float q1q1 = sq(q1);
    float q2q2 = sq(q2);
    float q3q3 = sq(q3);

    float q0q1 = q0 * q1;
    float q0q2 = q0 * q2;
    float q0q3 = q0 * q3;
    float q1q2 = q1 * q2;
    float q1q3 = q1 * q3;
    float q2q3 = q2 * q3;

    rMat[0][0] = 1.0f - 2.0f * q2q2 - 2.0f * q3q3;
    rMat[0][1] = 2.0f * (q1q2 + -q0q3);
    rMat[0][2] = 2.0f * (q1q3 - -q0q2);

    rMat[1][0] = 2.0f * (q1q2 - -q0q3);
    rMat[1][1] = 1.0f - 2.0f * q1q1 - 2.0f * q3q3;
    rMat[1][2] = 2.0f * (q2q3 + -q0q1);

    rMat[2][0] = 2.0f * (q1q3 + -q0q2);
    rMat[2][1] = 2.0f * (q2q3 - -q0q1);
    rMat[2][2] = 1.0f - 2.0f * q1q1 - 2.0f * q2q2;
}
*/
//attitude.values.roll = lrintf(atan2f(rMat[2][1], rMat[2][2]) * (1800.0f / M_PIf));
//attitude.values.pitch = lrintf(((0.5f * M_PIf) - acosf(-rMat[2][0])) * (1800.0f / M_PIf));
//attitude.values.yaw = lrintf((-atan2f(rMat[1][0], rMat[0][0]) * (1800.0f / M_PIf) + magneticDeclination));

	var ysqr = qy * qy

	// roll (x-axis rotation)
	var t0 = +2.0 * (qw * qx + qy * qz);
	var t1 = +1.0 - 2.0 * (qx * qx + ysqr);
	rpy[0] = Math.atan2(t0, t1) * RAD2DEG

	// pitch (y-axis rotation)
	var t2 = +2.0 * (qw * qy - qz * qx);
	t2 = t2 > 1.0 ? 1.0 : t2;
	t2 = t2 < -1.0 ? -1.0 : t2;
//	rpy[1] = Math.asin(t2) * RAD2DEG
	rpy[1] = (0.5*Math.PI - Math.acos(t2)) * RAD2DEG

	// yaw (z-axis rotation)
	var t3 = +2.0 * (qw * qz + qx * qy);
	var t4 = +1.0 - 2.0 * (ysqr + qz * qz);
	rpy[2] = Math.atan2(t3, t4) * RAD2DEG

	return rpy
}

