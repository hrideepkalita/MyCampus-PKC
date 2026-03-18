import profile1 from "@/assets/profile1.jpg";
import profile2 from "@/assets/profile2.jpg";
import profile3 from "@/assets/profile3.jpg";
import profile4 from "@/assets/profile4.jpg";

export type Interest = "Music" | "Sports" | "Gym" | "Gaming" | "Study" | "Travel" | "Movies" | "Photography" | "Coding" | "Fashion";
export type LookingFor = "Dating ❤️" | "Friendship 🤝" | "Not sure 🤷";
export type VerificationStatus = "pending" | "verified" | "rejected" | "unverified";

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  branch: string;
  bio: string;
  photo: string;
  interests: Interest[];
  lookingFor: LookingFor;
  verified: VerificationStatus;
  instagram?: string;
  phone?: string;
}

export interface Confession {
  id: string;
  text: string;
  tag: "crush" | "secret" | "compliment" | "guess-who";
  likes: number;
  timestamp: string;
  liked?: boolean;
}

export const ALL_INTERESTS: Interest[] = [
  "Music", "Sports", "Gym", "Gaming", "Study",
  "Travel", "Movies", "Photography", "Coding", "Fashion"
];

export const LOOKING_FOR_OPTIONS: LookingFor[] = [
  "Dating ❤️", "Friendship 🤝", "Not sure 🤷"
];

export const mockProfiles: UserProfile[] = [
  {
    id: "1",
    name: "Priya Sharma",
    age: 20,
    gender: "Female",
    branch: "B.A. English",
    bio: "Bookworm who loves chai and deep conversations ☕📚",
    photo: profile2,
    interests: ["Music", "Photography", "Travel", "Movies"],
    lookingFor: "Dating ❤️",
    verified: "verified",
    instagram: "@priya_reads",
  },
  {
    id: "2",
    name: "Rahul Das",
    age: 21,
    gender: "Male",
    branch: "B.Sc. Physics",
    bio: "Gym bro by day, gamer by night 🎮💪",
    photo: profile1,
    interests: ["Gym", "Gaming", "Coding", "Sports"],
    lookingFor: "Friendship 🤝",
    verified: "verified",
    instagram: "@rahul.das21",
  },
  {
    id: "3",
    name: "Ankur Borah",
    age: 22,
    gender: "Male",
    branch: "B.Com",
    bio: "Future CA | Cricket fanatic 🏏",
    photo: profile3,
    interests: ["Sports", "Study", "Movies", "Music"],
    lookingFor: "Dating ❤️",
    verified: "verified",
  },
  {
    id: "4",
    name: "Disha Kalita",
    age: 19,
    gender: "Female",
    branch: "B.Sc. Computer Science",
    bio: "Coding my way through college 💻✨",
    photo: profile4,
    interests: ["Coding", "Gaming", "Music", "Fashion"],
    lookingFor: "Not sure 🤷",
    verified: "verified",
    instagram: "@disha.codes",
  },
];

export const mockConfessions: Confession[] = [
  {
    id: "1",
    text: "I have a huge crush on someone in BA 3rd sem but I'm too shy to even make eye contact 😭",
    tag: "crush",
    likes: 42,
    timestamp: "2 hours ago",
  },
  {
    id: "2",
    text: "To the person who always saves me a seat in the library — you're the real MVP 🥺",
    tag: "compliment",
    likes: 67,
    timestamp: "5 hours ago",
  },
  {
    id: "3",
    text: "I pretend to study at the canteen but I'm actually just people-watching 👀",
    tag: "secret",
    likes: 31,
    timestamp: "1 day ago",
  },
  {
    id: "4",
    text: "Guess who got caught bunking class by their own parent at the market? 😂",
    tag: "guess-who",
    likes: 89,
    timestamp: "3 hours ago",
  },
  {
    id: "5",
    text: "The sunset from the college field yesterday was magical. If you were there too, maybe we shared a moment ✨",
    tag: "crush",
    likes: 55,
    timestamp: "12 hours ago",
  },
];

export const mockMatches: UserProfile[] = [mockProfiles[0], mockProfiles[3]];
