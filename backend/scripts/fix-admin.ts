import {prisma} from '../src/lib/prisma';
import bcrypt from 'bcryptjs';
(async()=>{
  const hash=await bcrypt.hash('Test1234!',10);
  const u=await prisma.user.upsert({
    where:{email:'bdanielparedesf@gmail.com'},
    update:{password:hash, role:'ADMIN', name:'Daniel', lastName:'Paredes'},
    create:{email:'bdanielparedesf@gmail.com', password:hash, role:'ADMIN', name:'Daniel', lastName:'Paredes'}
  });
  console.log('ADMIN UPSERT OK',u.email,u.role);
  await prisma.$disconnect();
})()