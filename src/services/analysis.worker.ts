import { handleRequest, type AnalysisRequest } from './analysisRequests';

// runs the slow readings away from the page, so typing, scrolling and the loading animation never stall
// the page sends { id, request }; this sends back { id, result } or { id, error }

const scope = self as unknown as {
  onmessage: ((event: { data: { id: number; request: AnalysisRequest } }) => void) | null;
  postMessage: (message: unknown) => void;
};

scope.onmessage = ({ data }) => {
  try {
    scope.postMessage({ id: data.id, result: handleRequest(data.request) });
  } catch (e) {
    scope.postMessage({ id: data.id, error: e instanceof Error ? e.message : String(e) });
  }
};
