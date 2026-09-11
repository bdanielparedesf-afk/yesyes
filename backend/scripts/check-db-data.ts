import {prisma} from '../src/lib/prisma';
(async()=>{
  console.log('USERS',await prisma.user.findMany({select:{email:true,role:true,password:true,emailVerified:true,isActive:true}}));
  console.log('PRODUCTS COUNT',await prisma.product.count());
  await prisma.$disconnect();
})()