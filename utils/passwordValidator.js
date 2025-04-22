
function isPasswordSecure(password) {
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
        return { secure: false, message: `Password must be at least ${minLength} characters long.` };
    }
    if (!hasUppercase) {
        return { secure: false, message: 'Password must contain at least one uppercase letter.' };
    }
    if (!hasLowercase) {
        return { secure: false, message: 'Password must contain at least one lowercase letter.' };
    }
    if (!hasNumber) {
        return { secure: false, message: 'Password must contain at least one number.' };
    }
    if (!hasSpecialChar) {
        return { secure: false, message: 'Password must contain at least one special character.' };
    }

    return { secure: true, message: 'Password is secure.' };
}

module.exports = { isPasswordSecure };
