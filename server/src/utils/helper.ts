import { Request, Response } from "express"
import sharp from 'sharp'

export enum Roles {
    admin = 'admin',
    checkout = 'checkout',
    waiter = 'waiter',
    bartender = 'bartender',
    superuser = 'superuser',
    client = 'client'
}

export function hasMatchingRole(arr1: Roles[], arr2: Roles[]): boolean {
    const set2 = new Set(arr2)

    for (const element of arr1) {
        if (set2.has(element)) {
            return true
        }
    }

    return false
}

export const authorizationMiddleware = (role: Roles | Roles[]) => (req: Request, res: Response, next: any) => {
    const userRoles = (req.user as any).roles
    if (!userRoles) {
        res.status(401).json('Unauthorized')
    }
    else {
        if (userRoles.includes(Roles.superuser)) {
            next()
        }
        else {
            if (Array.isArray(role)) {
                if (hasMatchingRole((req.user as any).roles, role)) {
                    next()
                } else {
                    res.status(401).json('Unauthorized')
                }
            }
            else {
                if ((req.user as any).roles?.includes(role)) {
                    next()
                } else {
                    res.status(401).json('Unauthorized')
                }
            }
        }
    }
}

export function getCurrentDateTimeInItaly(): string {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Europe/Rome',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);

    const year = parts.find(part => part.type === 'year')?.value;
    const month = parts.find(part => part.type === 'month')?.value;
    const day = parts.find(part => part.type === 'day')?.value;

    let hour = parts.find(part => part.type === 'hour')?.value;
    const minute = parts.find(part => part.type === 'minute')?.value;
    const second = parts.find(part => part.type === 'second')?.value;

    if (hour === '24') {
        hour = '00'
    }

    const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) (0\d|1\d|2[0-3]):[0-5]\d:[0-5]\d$/;
    const result = `${year}-${month}-${day} ${hour}:${minute}:${second}`

    if (dateRegex.test(result)) {
        return result
    }
    else {
        return '2024-01-01 00:00:00'
    }
}

export async function fileToBase64String(file: Express.Multer.File): Promise<string> {
    const avatarBuffer = file.buffer
    const optimizedAvatar = await sharp(avatarBuffer)
        .resize({ width: 200, height: 200 })
        .toBuffer()
    return `data:${file.mimetype};base64,${optimizedAvatar.toString('base64')}`
}