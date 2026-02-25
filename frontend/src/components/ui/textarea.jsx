import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-sm border border-slate-300 bg-slate-50 px-3 py-2 text-sm placeholder:text-slate-400 focus:bg-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }