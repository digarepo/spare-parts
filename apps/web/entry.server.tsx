// import * as React from "react";
// import { renderToPipeableStream } from "react-dom/server";
// import {
//   createStaticHandler,
//   createStaticRouter,
//   StaticRouterProvider,
// } from "react-router"; // ← v7: import from "react-router"
// import routes from "./app/routes";

// export async function render(url: string, requestHeaders: Record<string, string>) {
//   const request = new Request(url, { method: "GET", headers: new Headers(requestHeaders) });

//   // v7: get BOTH query + dataRoutes from the static handler
//   const { query, dataRoutes } = createStaticHandler(routes);
//   const context = await query(request);

//   if (context instanceof Response) {
//     return { type: "response", response: context } as const;
//   }

//   // v7: pass dataRoutes (not the original routes array)
//   const router = createStaticRouter(dataRoutes, context);

//   let didError = false;
//   const stream = renderToPipeableStream(
//     <React.StrictMode>
//       <StaticRouterProvider router={router} context={context} />
//     </React.StrictMode>,
//     {
//       onShellError(err) { didError = true; console.error("SSR shell error:", err); },
//       onError(err) { didError = true; console.error("SSR render error:", err); }
//     }
//   );

//   return { type: "stream", stream, didError } as const;
// }
