const signaturePrefix = /^(FLOWERS|BARBER|HAIR|BAKERY|FOOD|CAFE|BOUTIQUE|FURNITURE|REAL_ESTATE|MECHANIC|PHONE|CLEANING|PHOTO|TUTORING|CONSTRUCTION|BEAUTY|NAILS|PET|FITNESS|AUTO|PRO|DETAILING)_SIGNATURE_(EDITORIAL|ATLAS|NATIVE)$/;

export const isSignatureTemplate = (code?: string | null) => signaturePrefix.test(String(code || '').trim().toUpperCase());
export const signatureCategory = (code?: string | null) => String(code || '').trim().toUpperCase().match(signaturePrefix)?.[1] || '';
export const signatureVariant = (code?: string | null) => String(code || '').trim().toUpperCase().match(signaturePrefix)?.[2] || '';
