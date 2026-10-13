export const MARKETPLACE_CATEGORY_OPTIONS = {
  physical_product: [
    "Clothing & Accessories",
    "Electronics",
    "Home & Living",
    "Books & Media",
    "Handmade & Crafts",
    "Beauty & Personal Care",
    "Sports & Outdoors",
    "Food & Groceries",
    "Other",
  ],
  digital_product: [
    "Software & Apps",
    "Templates & Design Assets",
    "E-books & Guides",
    "Digital Art & Graphics",
    "Audio & Video",
    "Digital Downloads",
    "Other",
  ],
  service: [
    "Technology & Development",
    "Design & Creative",
    "Writing & Content",
    "Language Tutoring",
    "Translation",
    "Education & Tutoring",
    "Business & Consulting",
    "Marketing",
    "Local & Personal Services",
    "Other",
  ],
  creator_offering: [
    "Content Creation",
    "Graphic Design",
    "Photography & Video",
    "Digital Art",
    "Writing & Publishing",
    "Community & Membership",
    "Other",
  ],
  business: [
    "Retail",
    "Food & Hospitality",
    "Professional Services",
    "Local Business",
    "Wholesale & Distribution",
    "Agriculture",
    "Other",
  ],
  course: [
    "Technology & Programming",
    "Business & Entrepreneurship",
    "Language Learning",
    "Academic Tutoring",
    "Career Development",
    "Arts & Creative Skills",
    "Other",
  ],
  event: [
    "Workshops & Training",
    "Conferences",
    "Networking",
    "Cultural & Community Events",
    "Entertainment",
    "Online Events",
    "Other",
  ],
};

export const getMarketplaceCategoryOptions = (type) =>
  MARKETPLACE_CATEGORY_OPTIONS[type] || [];

export const selectMarketplaceListingType = (listing, type) => ({
  ...listing,
  type,
  category: "",
  customCategory: "",
  condition:
    type === "physical_product" ? listing.condition : "not_applicable",
});

export const resolveMarketplaceCategory = (selection, customCategory = "") => {
  const value = selection === "Other" ? customCategory : selection;
  const category = typeof value === "string" ? value.trim() : "";

  if (!category) {
    return {
      category: "",
      error:
        selection === "Other"
          ? "Enter a category to continue."
          : "Select a category to continue.",
    };
  }

  if (category.length > 80) {
    return {
      category: "",
      error: "Category must be 80 characters or fewer.",
    };
  }

  return { category, error: "" };
};