import type { Session } from "next-auth";
import type { ListMovie } from "./db";

export const makeMovie = (overrides: Partial<ListMovie> = {}): ListMovie => ({
  image: "/img.jpg",
  name: "Fury",
  movieId: 1,
  rating: 0,
  status: "Completed",
  type: "movie",
  ...overrides,
});

export const makeUser = (
  overrides: Partial<Session["user"]> = {},
): Session["user"] => {
  const id = overrides.id ?? crypto.randomUUID();
  return {
    id,
    name: "Test User",
    email: `${id}@test.local`,
    image: "/CineRadarLogo.png",
    ...overrides,
  };
};

export const makeSession = (user: Session["user"] = makeUser()): Session => ({
  user,
  expires: new Date(Date.now() + 86_400_000).toISOString(),
});
