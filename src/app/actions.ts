"use server";

export async function fetchMovies(formData: FormData) {
  console.log(formData.get("description"));
}
