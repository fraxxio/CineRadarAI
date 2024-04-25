import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container mt-40 w-fit rounded-sm border border-border-clr bg-primary-bg p-12 text-center text-red-700">
      <svg
        fill="#B91C1C"
        height="200px"
        width="200px"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-47.71 -47.71 572.49 572.49"
        stroke="#B91C1C"
        strokeWidth="0.0047706499999999995"
        className="mx-auto"
      >
        <g id="404" stroke-width="0"></g>
        <g
          id="SVGRepo_tracerCarrier"
          strokeLinecap="round"
          strokeLinejoin="round"
          stroke="#CCCCCC"
          strokeWidth="11.44956"
        ></g>
        <g id="404">
          <g>
            <path d="M451.612,34.739H25.453C11.399,34.739,0,46.138,0,60.192v269.219c0,14.054,11.399,25.453,25.453,25.453h168.697 l-22.719,54.664h-10.421c-9.053,0-16.398,7.345-16.398,16.398s7.345,16.4,16.398,16.4h155.046c9.053,0,16.4-7.347,16.4-16.4 s-7.347-16.398-16.4-16.398h-10.421l-22.719-54.664h168.696c14.054,0,25.453-11.399,25.453-25.453V60.192 C477.065,46.138,465.666,34.739,451.612,34.739z M369.291,338.394c-6.585,0-11.927-5.342-11.927-11.927 c0-6.585,5.341-11.927,11.927-11.927c6.583,0,11.927,5.341,11.927,11.927C381.217,333.052,375.874,338.394,369.291,338.394z M408.052,338.394c-6.585,0-11.927-5.342-11.927-11.927c0-6.585,5.341-11.927,11.927-11.927c6.583,0,11.927,5.341,11.927,11.927 C419.979,333.052,414.636,338.394,408.052,338.394z M431.642,290.393c0,6.149-4.985,11.135-11.135,11.135H56.557 c-6.149,0-11.135-4.985-11.135-11.135V96.656c0-6.151,4.985-11.135,11.135-11.135h363.949c6.149,0,11.135,4.984,11.135,11.135 V290.393z"></path>
            <path d="M179.023,195.779h-3.338v-55.238c0-2.942-2.377-5.319-5.311-5.319h-21.307c-1.832,0-3.54,0.948-4.504,2.509l-35.78,57.59 c-1.164,1.856-1.77,3.999-1.77,6.189v7.065c0,2.944,2.376,5.319,5.311,5.319h40.469v13.192c0,6.321,5.125,11.445,11.445,11.445 c6.321,0,11.446-5.124,11.446-11.445v-13.192h3.338c5.001,0,9.053-4.053,9.053-9.061 C188.076,199.832,184.024,195.779,179.023,195.779z M152.794,172.889v22.89h-23.201v-0.318l13.822-22.572 c3.494-6.515,6.195-12.556,9.535-19.226h0.636C153.104,160.333,152.794,166.692,152.794,172.889z"></path>
            <path d="M236.125,133.476c-26.711,0-39.429,23.681-39.429,53.56c0.172,29.242,11.927,53.243,38.623,53.243 c26.383,0,39.258-21.935,39.258-53.88C274.576,158.113,263.767,133.476,236.125,133.476z M235.954,222.001 c-9.365,0-15.094-11.283-14.94-34.966c-0.154-24,5.887-35.282,14.784-35.282c9.691,0,14.628,12.083,14.628,34.964 C250.427,210.245,245.333,222.001,235.954,222.001z"></path>
            <path d="M355.531,195.779h-3.338v-55.238c0-2.942-2.377-5.319-5.311-5.319h-21.307c-1.832,0-3.54,0.948-4.503,2.509l-35.78,57.59 c-1.164,1.856-1.77,3.999-1.77,6.189v7.065c0,2.944,2.376,5.319,5.311,5.319h40.469v13.192c0,6.321,5.125,11.445,11.445,11.445 c6.321,0,11.446-5.124,11.446-11.445v-13.192h3.338c5.001,0,9.055-4.053,9.055-9.061 C364.585,199.832,360.532,195.779,355.531,195.779z M329.302,172.889v22.89h-23.201v-0.318l13.822-22.572 c3.494-6.515,6.195-12.556,9.535-19.226h0.636C329.612,160.333,329.302,166.692,329.302,172.889z"></path>
          </g>
        </g>
      </svg>
      <h1 className="text-4xl font-semibold">Not found</h1>
      <p className="pb-12">
        Page that you are trying to visit doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="mx-auto flex max-w-[50%] items-center justify-center gap-2 rounded border border-border-clr bg-dark-bg px-2 py-1 text-xl font-medium text-primary-text duration-200 hover:bg-primary-text hover:text-dark-bg"
      >
        Return Home
        <ArrowRight size={20} />
      </Link>
    </main>
  );
}
