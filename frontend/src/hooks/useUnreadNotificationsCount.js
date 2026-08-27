import { useQuery } from "@tanstack/react-query";
import { getNotifications } from "../lib/api.js";

const useUnreadNotificationsCount = () => {
  const { data } = useQuery({
    queryKey: ["notifications", "unreadCount"],
    queryFn: () => getNotifications({ page: 1, limit: 1 }),
    staleTime: 30000,
  });

  return data?.unreadCount ?? 0;
};

export default useUnreadNotificationsCount;
