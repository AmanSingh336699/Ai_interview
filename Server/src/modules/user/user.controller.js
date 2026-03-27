import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import * as userService from './user.service.js';

export const getProfile = asyncHandler(async (req, res) => {
  const profile = await userService.getProfile(req.user.id);
  res.json(new ApiResponse(200, profile));
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body);
  res.json(new ApiResponse(200, user, 'Profile updated'));
});

export const getAnalytics = asyncHandler(async (req, res) => {
  const analytics = await userService.getAnalytics(req.user.id);
  res.json(new ApiResponse(200, analytics));
});

export const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await userService.getDashboard(req.user.id);
  res.json(new ApiResponse(200, dashboard));
});
