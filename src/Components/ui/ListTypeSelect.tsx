import React, { Dispatch, SetStateAction } from "react";

type ListTypeSelectProps = {
  props?: React.HTMLProps<HTMLSelectElement>;
  setStatus: Dispatch<SetStateAction<string>>;
  status: string;
};

export default function ListTypeSelect({
  props,
  setStatus,
  status,
}: ListTypeSelectProps) {
  const statusTypes = ["Planning to watch", "Completed", "Watching"];
  return (
    <select
      id="status"
      name="status"
      {...props}
      value={status}
      required
      onChange={(e) => setStatus(e.target.value)}
      className="rounded-sm border border-border-clr bg-dark-bg p-2 outline-1 outline-primary-text duration-200 focus:outline max-lg:w-[12rem] max-[480px]:w-full"
    >
      <option
        value=""
        className="bg-primary-text text-primary-bg last:rounded-md"
      >
        Choose status
      </option>
      {statusTypes.map((statusType: string) => {
        return (
          <option
            value={statusType}
            className="bg-primary-text text-primary-bg last:rounded-md"
            key={statusType}
          >
            {statusType}
          </option>
        );
      })}
    </select>
  );
}
