import { useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { logout } from "../lib/api.js";
import { disconnectStreamClient } from "./useStreamClient.js";
import { disconnectStreamVideoClient } from "../lib/streamVideoClient.js";

const useLogout = () => {
  const queryClient = useQueryClient();

  const {
    mutate: logoutMutation,
    isPending,
    error,
  } = useMutation({
    mutationFn: async () => {
      await Promise.allSettled([
        disconnectStreamClient(),
        disconnectStreamVideoClient(),
      ]);
      return logout();
    },
    onSuccess: () => {
      queryClient.setQueryData(["authUser"], null);
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "authUser",
      });
    },
  });

  return { logoutMutation, isPending, error };
};

export default useLogout;
