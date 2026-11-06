// How an InsuranceClaim reached ClaimStatus.REJECTED (3). All four paths land
// in the same status, so the kind is what keeps them apart for consumers.
export const REJECTION_KIND_NONE: i32 = 0;
// ClaimRejected: a reviewer rejected a SUBMITTED claim.
export const REJECTION_KIND_REVIEWER: i32 = 1;
// ClaimForceRejected: the super-admin escape hatch out of APPROVED.
export const REJECTION_KIND_SUPER_ADMIN: i32 = 2;
// ApprovedClaimCancelled: a currency approver reversed an APPROVED claim.
export const REJECTION_KIND_APPROVER_CANCEL: i32 = 3;
// ContestExpiredClaimRejected: an Ops contest stood CONTEST_MAX_DURATION and
// anyone finalised it (`rejectExpiredContest`).
export const REJECTION_KIND_CONTEST_EXPIRED: i32 = 4;
