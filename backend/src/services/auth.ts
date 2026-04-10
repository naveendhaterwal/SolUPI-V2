import bcrypt from "bcryptjs";

import jwt from "jsonwebtoken";

export async function hashPassword(password:string) : (Promise<string> ){
    return await bcrypt.hash(password,12)

}

export async function verifyPassword(password:string    ,hashedPassword:string) : (Promise<boolean> ){
    return await bcrypt.compare(password,hashedPassword)

}

export  function generateToken(userId:string) : (string){
    return  jwt.sign({userId},process.env.JWT_SECRET!,{expiresIn:"7d"})

}

export  function verifyToken(token:string) {
    try{
        return jwt.verify(token,process.env.JWT_SECRET!)

    }
    catch{
        return null
    }

}








