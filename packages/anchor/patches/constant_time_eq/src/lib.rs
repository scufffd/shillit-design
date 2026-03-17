#![cfg_attr(not(feature = "std"), no_std)]

#[inline]
#[must_use]
fn constant_time_ne(a: &[u8], b: &[u8]) -> u8 {
    assert!(a.len() == b.len());
    let len = a.len();
    let a = &a[..len];
    let b = &b[..len];
    let mut tmp = 0u8;
    for i in 0..len {
        tmp |= a[i] ^ b[i];
    }
    tmp
}

/// Compares two equal-sized byte strings in constant time.
#[must_use]
pub fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && constant_time_ne(a, b) == 0
}

#[inline]
#[must_use]
pub fn constant_time_eq_16(a: &[u8; 16], b: &[u8; 16]) -> bool {
    constant_time_eq(a, b)
}

#[inline]
#[must_use]
pub fn constant_time_eq_32(a: &[u8; 32], b: &[u8; 32]) -> bool {
    constant_time_eq(a, b)
}

#[inline]
#[must_use]
pub fn constant_time_eq_64(a: &[u8; 64], b: &[u8; 64]) -> bool {
    constant_time_eq(a, b)
}
