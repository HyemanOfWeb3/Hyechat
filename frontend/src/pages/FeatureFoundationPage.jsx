import { Link } from "react-router-dom";
import { ArrowLeft, Construction } from "lucide-react";

const FeatureFoundationPage = ({
  title,
  description,
  actionLabel = "Back home",
  actionTo = "/",
}) => (
  <div className="flex w-full items-center justify-center bg-base-100 p-6">
    <div className="max-w-lg text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Construction className="size-7" />
      </div>
      <h1 className="mt-5 text-3xl font-bold">{title}</h1>
      <p className="mt-3 text-base-content/60">{description}</p>
      <Link to={actionTo} className="btn btn-primary mt-6">
        <ArrowLeft className="size-4" /> {actionLabel}
      </Link>
    </div>
  </div>
);

export default FeatureFoundationPage;
