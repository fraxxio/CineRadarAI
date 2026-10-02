import React from "react";
import { LIST_STATUSES, type ListStatus } from "../entry";

type StatusSelectProps = {
  props?: React.HTMLProps<HTMLSelectElement>;
  setStatus: (status: ListStatus | "") => void;
  status: ListStatus | "";
};

export default function StatusSelect({
  props,
  setStatus,
  status,
}: StatusSelectProps) {
  return (
    <select
      id="status"
      name="status"
      {...props}
      value={status}
      required
      onChange={(e) => setStatus(e.target.value as ListStatus | "")}
      className="rounded-sm border border-border-clr bg-dark-bg p-2 outline-1 outline-primary-text duration-200 focus:outline max-lg:w-[12rem] max-[480px]:w-full"
    >
      <option
        value=""
        className="bg-primary-text text-primary-bg last:rounded-md"
      >
        Choose status
      </option>
      {LIST_STATUSES.map(({ value }) => {
        return (
          <option
            value={value}
            className="bg-primary-text text-primary-bg last:rounded-md"
            key={value}
          >
            {value}
          </option>
        );
      })}
    </select>
  );
}
