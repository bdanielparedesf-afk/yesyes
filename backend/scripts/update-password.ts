import {prisma} from '../src/lib/prisma';
import bcrypt from 'bcryptjs';
(async()=>{
  const p='Tomi2611@';
  const h=await bcrypt.hash(p,10);
  try{
    const u=await prisma.user.update({where:{email:'bdanielparedesf@gmail.com'}, data:{password:h}});
    console.log('OK password',u.email)
  }catch{
    const u=await prisma.user.update({where:{email:'bdanielparedesf@gmail.com'}, data:{passwordHash:h}});
    console.log('OK passwordHash',u.email)
  };
  await prisma.$disconnect();
})()