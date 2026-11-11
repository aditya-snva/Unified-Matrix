// Every message source the app knows about. Add new platforms here first.
export const PLATFORMS = ['sms', 'telegram', 'gmail', 'whatsapp'];

export const isPlatform = (value) => PLATFORMS.includes(value);
