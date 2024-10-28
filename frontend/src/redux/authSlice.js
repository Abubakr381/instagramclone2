import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// Thunk to handle following a user
export const followUser = createAsyncThunk(
    'auth/followUser',
    async (userId, { getState, dispatch, rejectWithValue }) => {
        try {
            const response = await axios.post(`/api/users/${userId}/follow`);
            return { userId, followerId: getState().auth.user._id, data: response.data };
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

// Thunk to handle unfollowing a user
export const unfollowUser = createAsyncThunk(
    'auth/unfollowUser',
    async (userId, { getState, dispatch, rejectWithValue }) => {
        try {
            const response = await axios.post(`/api/users/${userId}/unfollow`);
            return { userId, followerId: getState().auth.user._id, data: response.data };
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

const authSlice = createSlice({
    name: "auth",
    initialState: {
        user: null,
        suggestedUsers: [],
        userProfile: null,
        selectedUser: null,
        status: 'idle', // 'loading', 'succeeded', 'failed'
        error: null
    },
    reducers: {
        setAuthUser: (state, action) => {
            state.user = action.payload;
        },
        setSuggestedUsers: (state, action) => {
            state.suggestedUsers = action.payload;
        },
        setUserProfile: (state, action) => {
            state.userProfile = action.payload;
        },
        setSelectedUser: (state, action) => {
            state.selectedUser = action.payload;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(followUser.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(followUser.fulfilled, (state, action) => {
                state.status = 'succeeded';
                const { userId, followerId } = action.payload;

                // Update the followers list in userProfile
                if (state.userProfile && state.userProfile._id === userId) {
                    state.userProfile.followers.push(followerId);
                }

                // Update the following list in the auth user profile
                if (state.user) {
                    state.user.following.push(userId);
                }
                state.error = null;
            })
            .addCase(followUser.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload;
            })
            .addCase(unfollowUser.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(unfollowUser.fulfilled, (state, action) => {
                state.status = 'succeeded';
                const { userId, followerId } = action.payload;

                // Update the followers list in userProfile
                if (state.userProfile && state.userProfile._id === userId) {
                    state.userProfile.followers = state.userProfile.followers.filter(
                        (id) => id !== followerId
                    );
                }

                // Update the following list in the auth user profile
                if (state.user) {
                    state.user.following = state.user.following.filter(
                        (id) => id !== userId
                    );
                }
                state.error = null;
            })
            .addCase(unfollowUser.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload;
            });
    }
});

export const {
    setAuthUser,
    setSuggestedUsers,
    setUserProfile,
    setSelectedUser,
} = authSlice.actions;

export default authSlice.reducer;
