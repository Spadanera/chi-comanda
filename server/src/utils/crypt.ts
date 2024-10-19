import bcrypt from 'bcrypt'

const saltRounds = 10

async function hashPassword(password: string | undefined): Promise<string> {
    try {
        const salt = await bcrypt.genSalt(saltRounds);
        const hash = await bcrypt.hash(password || '', salt);
        return hash;
    } catch (error) {
        // Handle error appropriately (e.g., log it, throw a custom error)
        console.error("Error hashing password:", error);
        throw error;
    }
}

export default hashPassword