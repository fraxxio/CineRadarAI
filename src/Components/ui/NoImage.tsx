import { Image } from "lucide-react";

type NoImageProps = {
  title: string;
};

export const NoImage = ({ title }: NoImageProps) => {
  return (
    <div className="flex h-[80%] w-full flex-col justify-center gap-8 border-b border-border-clr bg-slate-950 px-2 text-center">
      <div className="flex items-center justify-center gap-2">
        <p> No Image</p>
        <Image size={20} />
      </div>
      <p className="font-medium">{title}</p>
    </div>
  );
};
