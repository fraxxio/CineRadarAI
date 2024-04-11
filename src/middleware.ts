// import { authConfig } from "@/auth";
// import NextAuth from "next-auth";

// const { auth } = NextAuth(authConfig);

// const publicRoutes = ["/", "/search", "/signin"];

// export default auth((req) => {
//   const { nextUrl } = req;

//   const isAuthenticated = !!req.auth;
//   const isPublicRoute = publicRoutes.includes(nextUrl.pathname);

//   if (!isAuthenticated && !isPublicRoute)
//     return Response.redirect(new URL("/signin", nextUrl));
// });

// export const config = {
//   matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
// };

export { auth as middleware } from "./auth";
