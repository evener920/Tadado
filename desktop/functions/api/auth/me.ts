import { json, currentUser, type Env } from "./_common";
export const onRequestGet = async ({request,env}: {request: Request; env: Env}) => {
  const user=await currentUser(request,env);
  return user ? json({user}) : json({user:null},401);
};
