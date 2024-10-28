import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";
import { Post } from "../models/post.model.js";

// Register a new user
export const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ message: "All fields are required", success: false });
        }
        
        const existingUser = await User.findOne({ email });
        
        if (existingUser) {
            return res.status(400).json({ message: "Email already in use", success: false });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await User.create({
            username,
            email,
            password: hashedPassword
        });
        
        return res.status(201).json({ message: "Account created successfully.", success: true });
    } catch (error) {
        console.error("Register error:", error);
        return res.status(500).json({ message: "Internal server error", success: false });
    }
};

// Login a user
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required", success: false });
        }
        
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(400).json({ message: "Invalid email or password", success: false });
        }
        
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        
        if (!isPasswordMatch) {
            return res.status(400).json({ message: "Invalid email or password", success: false });
        }

        const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, { expiresIn: '1d' });
        
        const populatedPosts = await Promise.all(
            user.posts.map(async (postId) => {
                const post = await Post.findById(postId);
                return post && post.author.equals(user._id) ? post : null;
            })
        );
        
        const userResponse = {
            _id: user._id,
            username: user.username,
            email: user.email,
            profilePicture: user.profilePicture,
            bio: user.bio,
            followers: user.followers,
            following: user.following,
            posts: populatedPosts
        };
        
        return res.cookie('token', token, { httpOnly: true, sameSite: 'strict', maxAge: 24 * 60 * 60 * 1000 })
                  .json({ message: `Welcome back ${user.username}`, success: true, user: userResponse });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ message: "Internal server error", success: false });
    }
};

// Logout a user
export const logout = async (_, res) => {
    try {
        return res.cookie("token", "", { maxAge: 0 }).json({ message: 'Logged out successfully.', success: true });
    } catch (error) {
        console.error("Logout error:", error);
        return res.status(500).json({ message: "Internal server error", success: false });
    }
};

// Get user profile
export const getProfile = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId).populate({ path: 'posts', options: { sort: { createdAt: -1 } } }).populate('bookmarks');
        
        if (!user) {
            return res.status(404).json({ message: "User not found", success: false });
        }
        
        return res.status(200).json({ user, success: true });
    } catch (error) {
        console.error("Get profile error:", error);
        return res.status(500).json({ message: "Internal server error", success: false });
    }
};

// Edit user profile
export const editProfile = async (req, res) => {
    try {
        const userId = req.id;
        const { bio, gender } = req.body;
        const profilePicture = req.file;
        
        let cloudResponse;
        
        if (profilePicture) {
            const fileUri = getDataUri(profilePicture);
            cloudResponse = await cloudinary.uploader.upload(fileUri);
        }
        
        const user = await User.findById(userId).select('-password');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found.', success: false });
        }
        
        if (bio) user.bio = bio;
        if (gender) user.gender = gender;
        if (profilePicture) user.profilePicture = cloudResponse.secure_url;
        
        await user.save();
        
        return res.status(200).json({ message: 'Profile updated.', success: true, user });
    } catch (error) {
        console.error("Edit profile error:", error);
        return res.status(500).json({ message: "Internal server error", success: false });
    }
};

// Get suggested users
export const getSuggestedUsers = async (req, res) => {
    try {
        const suggestedUsers = await User.find({ _id: { $ne: req.id } }).select("-password");
        
        if (!suggestedUsers || suggestedUsers.length === 0) {
            return res.status(400).json({ message: 'No suggested users at this time', success: false });
        }
        
        return res.status(200).json({ success: true, users: suggestedUsers });
    } catch (error) {
        console.error("Get suggested users error:", error);
        return res.status(500).json({ message: "Internal server error", success: false });
    }
};

// Follow or unfollow a user
export const followOrUnfollow = async (req, res) => {
    try {
        const currentUserId = req.id;
        const targetUserId = req.params.id;
        
        if (currentUserId === targetUserId) {
            return res.status(400).json({ message: 'You cannot follow/unfollow yourself', success: false });
        }

        const [user, targetUser] = await Promise.all([
            User.findById(currentUserId),
            User.findById(targetUserId)
        ]);

        if (!user || !targetUser) {
            return res.status(404).json({ message: 'User not found', success: false });
        }

        const isFollowing = user.following.includes(targetUserId);

        if (isFollowing) {
            // Unfollow
            await Promise.all([
                User.findByIdAndUpdate(currentUserId, { $pull: { following: targetUserId } }),
                User.findByIdAndUpdate(targetUserId, { $pull: { followers: currentUserId } })
            ]);
            return res.status(200).json({ message: 'Unfollowed successfully', success: true, updatedFollowerCount: targetUser.followers.length - 1 });
        } else {
            // Follow
            await Promise.all([
                User.findByIdAndUpdate(currentUserId, { $push: { following: targetUserId } }),
                User.findByIdAndUpdate(targetUserId, { $push: { followers: currentUserId } })
            ]);
            return res.status(200).json({ message: 'Followed successfully', success: true, updatedFollowerCount: targetUser.followers.length + 1 });
        }
    } catch (error) {
        console.error("Follow/Unfollow error:", error);
        return res.status(500).json({ message: 'Internal server error', success: false });
    }
};
