type Tmessage = {
  id: string;
  role: string;
  content: string;
  // the user stopped this answer before it finished
  stopped?: boolean;
}[];
