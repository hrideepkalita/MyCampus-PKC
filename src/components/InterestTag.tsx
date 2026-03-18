interface InterestTagProps {
  interest: string;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
}

const InterestTag = ({ interest, selected, onClick, size = "sm" }: InterestTagProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full border font-body transition-all ${
        size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3.5 py-1.5 text-sm"
      } ${
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
      } ${onClick ? "cursor-pointer active:scale-95" : "cursor-default"}`}
    >
      {interest}
    </button>
  );
};

export default InterestTag;
