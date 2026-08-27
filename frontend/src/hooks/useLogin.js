import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login } from "../lib/api.js";
import toast from "react-hot-toast";

const useLogin = () => {
  const queryClient = useQueryClient();
  const {
    mutate,
    isPending,
    error,
  } = useMutation({
    mutationFn: login,

    onSuccess: () => {
      toast.success("Login successful!");
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
    },
  });

    
  return { loginMutation: mutate, isPending, error };

};


export default useLogin;
