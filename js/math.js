"use strict";
//---------------------------------------------------------------------------------------------------
// IMU algorithm update
//
// v ==> u
// v/u = [x, y, z]
// qout = [q0, q1, q2, q3] (w, x, y, z)
function accRot(v, u, qout) {
	var ux = u[0]
	var uy = u[1]
	var uz = u[2]

	var vx = v[0]
	var vy = v[1]
	var vz = v[2]

	var recipNorm

// from http://lolengine.net/blog/2014/02/24/quaternion-from-two-vectors-final
// web cache: http://webcache.googleusercontent.com/search?q=cache:BhqKfm1NVhMJ:lolengine.net/blog/2014/02/24/quaternion-from-two-vectors-final+&cd=3&hl=zh-TW&ct=clnk&gl=tw
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

// rpy = [r, p, y]
// from https://en.wikipedia.org/wiki/Conversion_between_quaternions_and_Euler_angles#Quaternion_to_Euler_Angles_Conversion
function q2euler(q, rpy) {
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
	rpy[1] = Math.asin(t2) * RAD2DEG // from wiki
//	rpy[1] = (0.5*Math.PI - Math.acos(t2)) * RAD2DEG // from betaflight imu.c

	// yaw (z-axis rotation)
	var t3 = +2.0 * (qw * qz + qx * qy);
	var t4 = +1.0 - 2.0 * (ysqr + qz * qz);
	rpy[2] = Math.atan2(t3, t4) * RAD2DEG

	return rpy
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

