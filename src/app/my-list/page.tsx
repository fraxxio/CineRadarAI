import { auth } from "@/auth";
import Image from "next/image";

export default async function page() {
  const session = await auth();

  const safeSession = session!;
  return (
    <div>
      <Image
        alt="profile"
        width={100}
        height={100}
        src={safeSession.user.image}
      />
      <p>{safeSession.user.name}</p>
    </div>
  );
}
